import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfig, synthesize, SynthesisError, type SynthesisOutput } from "@/lib/llm";
import { checkItemEvidence } from "@/lib/evidence/match";
import { normalize } from "@/lib/evidence/normalize";
import { getSettings } from "@/lib/settings";
import type { ExtractedDoc } from "@/lib/ingest/types";
import type { ProjectFile } from "@/lib/db/types";

const PROJECT_HOURLY_CAP = 6;

export type SynthesisResult =
  | { ok: true; runId: string; mode: "live" | "mock"; items: number }
  | { ok: false; status: number; error: string };

type NewItem = {
  kind: "objective" | "completed" | "next_task" | "lesson";
  title: string;
  description: string;
  effort: "small" | "medium" | "large" | null;
  lesson_type: "methodology" | "evaluation_feedback" | "funding_feedback" | "blocker" | null;
  objective_status: "done" | "in_progress" | "not_started" | null;
  evidence: { file: string; page: number; quote: string }[];
};

function flatten(out: SynthesisOutput): NewItem[] {
  const base = { description: "", effort: null, lesson_type: null, objective_status: null } as const;
  return [
    ...out.objectives.map((o): NewItem => ({ ...base, kind: "objective", title: o.title, objective_status: o.status, evidence: o.evidence })),
    ...out.completed.map((c): NewItem => ({ ...base, kind: "completed", title: c.title, description: c.description, evidence: c.evidence })),
    ...out.next_tasks.map((t): NewItem => ({ ...base, kind: "next_task", title: t.title, description: t.description, effort: t.effort, evidence: t.evidence })),
    ...out.lessons.map((l): NewItem => ({ ...base, kind: "lesson", title: l.text, lesson_type: l.type, evidence: l.evidence })),
  ];
}

/**
 * Runs one synthesis for a project. The CALLER must already have authorized the request
 * (a creator from the API route, or an admin retrying a failed run after writing the audit row).
 * `requestedBy` is the user the run counts against for the daily cap.
 */
export async function runSynthesis(projectId: string, requestedBy: string | null): Promise<SynthesisResult> {
  const admin = createAdminClient();
  const settings = await getSettings();

  const { data: project } = await admin.from("projects").select("id, status, tech").eq("id", projectId).maybeSingle();
  if (!project) return { ok: false, status: 404, error: "Project not found." };
  if (!["draft", "awaiting_advisor", "verifying"].includes(project.status)) {
    return { ok: false, status: 409, error: "This project is already published." };
  }

  // Consent gate: never send private data to a model before advisor and team consent exist.
  const [{ data: members }, { data: consents }] = await Promise.all([
    admin.from("project_members").select("consented_at").eq("project_id", projectId).eq("role", "creator"),
    admin.from("advisor_consents").select("status").eq("project_id", projectId).eq("status", "approved"),
  ]);
  const teamDone = (members ?? []).length > 0 && (members ?? []).every((m) => m.consented_at);
  if (!teamDone || (consents ?? []).length === 0) {
    return {
      ok: false,
      status: 409,
      error: "ESTAFET reads your files only after every team member has confirmed and your advisor has approved. Finish the Consent step first.",
    };
  }

  // Rate limits: per user per day (setting), per project per hour.
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const cap = settings.synthesis_daily_cap.value;
  const [userCount, projectCount] = await Promise.all([
    requestedBy
      ? admin.from("synthesis_runs").select("id", { count: "exact", head: true }).eq("requested_by", requestedBy).gte("created_at", since(86_400_000))
      : Promise.resolve({ count: 0 }),
    admin.from("synthesis_runs").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("created_at", since(3_600_000)),
  ]);
  if ((userCount.count ?? 0) >= cap) return { ok: false, status: 429, error: `The daily limit of ${cap} runs was reached. Try again tomorrow.` };
  if ((projectCount.count ?? 0) >= PROJECT_HOURLY_CAP) {
    return { ok: false, status: 429, error: "This project already ran several times in the last hour. Wait a little, then try again." };
  }

  const { data: fileRows } = await admin.from("project_files").select("*").eq("project_id", projectId).order("created_at");
  const files = ((fileRows ?? []) as ProjectFile[]).filter((f) => f.extracted_text_path);
  if (files.length === 0) return { ok: false, status: 400, error: "Upload at least one readable file first." };

  const docsById = new Map<string, ExtractedDoc>();
  for (const f of files) {
    const { data } = await admin.storage.from("extracted-text").download(f.extracted_text_path!);
    if (!data) continue;
    try {
      docsById.set(f.id, JSON.parse(await data.text()) as ExtractedDoc);
    } catch {
      /* unreadable extraction is skipped */
    }
  }
  const docs = files.map((f) => docsById.get(f.id)).filter((d): d is ExtractedDoc => Boolean(d));
  if (docs.length === 0) return { ok: false, status: 400, error: "The uploaded files could not be read. Upload them again." };

  const config = getConfig();
  const inputHash = createHash("sha256").update(docs.map((d) => d.fileName + d.pages.map((p) => p.text).join("\n")).join("\n--\n")).digest("hex");
  const { data: run, error: runError } = await admin
    .from("synthesis_runs")
    .insert({
      project_id: projectId, provider: config.provider, model: config.model, mode: config.mode, status: "running",
      input_hash: inputHash, requested_by: requestedBy, started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (runError || !run) return { ok: false, status: 500, error: "Could not start the run." };

  try {
    const output = await synthesize(docs, config);
    const idByName = new Map(files.map((f) => [f.original_name, f.id]));
    const pagesByFile = new Map<string, Map<number, string>>();
    for (const f of files) {
      const d = docsById.get(f.id);
      if (d) pagesByFile.set(f.id, new Map(d.pages.map((p) => [p.page, p.text])));
    }

    // Replace earlier pending AI items. Reviewed items stay, and duplicates of them are skipped.
    await admin.from("draft_items").delete().eq("project_id", projectId).eq("origin", "ai").eq("review_status", "pending");
    const { data: existing } = await admin.from("draft_items").select("title, position").eq("project_id", projectId);
    const known = new Set((existing ?? []).map((e) => normalize(e.title)));
    let position = Math.max(0, ...(existing ?? []).map((e) => e.position)) + 1;

    const rows = [];
    for (const item of flatten(output)) {
      if (known.has(normalize(item.title))) continue;
      known.add(normalize(item.title));
      const evidence = item.evidence.map((e) => ({ file_id: idByName.get(e.file) ?? "", page: e.page, quote: e.quote })).filter((e) => e.file_id);
      rows.push({
        project_id: projectId, run_id: run.id, kind: item.kind, title: item.title.slice(0, 300),
        description: item.description.slice(0, 600), effort: item.effort, lesson_type: item.lesson_type,
        objective_status: item.objective_status, evidence, evidence_status: checkItemEvidence(evidence, pagesByFile),
        origin: "ai", review_status: "pending", position: position++,
      });
    }
    if (rows.length > 0) {
      const { error } = await admin.from("draft_items").insert(rows);
      if (error) throw new SynthesisError("The draft could not be saved.");
    }
    if ((project.tech as string[]).length === 0 && output.tech.length > 0) {
      await admin.from("projects").update({ tech: output.tech }).eq("id", projectId);
    }
    await admin.from("synthesis_runs").update({ status: "done", finished_at: new Date().toISOString(), summary_draft: output.summary }).eq("id", run.id);
    return { ok: true, runId: run.id, mode: config.mode, items: rows.length };
  } catch (e) {
    const message = e instanceof SynthesisError ? e.message : "The draft could not be created. Please try again.";
    await admin.from("synthesis_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: message }).eq("id", run.id);
    return { ok: false, status: 502, error: message };
  }
}
