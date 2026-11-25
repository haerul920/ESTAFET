import "server-only";
import { createHash } from "node:crypto";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfig, synthesize, SynthesisError, type SynthesisOutput } from "@/lib/llm";
import { checkItemEvidence, type EvidenceStatus } from "@/lib/evidence/match";
import { readPendingImages } from "@/lib/ingest/image-readings";
import { normalize } from "@/lib/evidence/normalize";
import { getSettings } from "@/lib/settings";
import { globalSynthesisCap } from "@/lib/settings-core";
import { alert } from "@/lib/log";
import { allow } from "@/lib/rate-limit";
import type { ExtractedDoc } from "@/lib/ingest/types";
import type { ProjectFile } from "@/lib/db/types";

const PROJECT_HOURLY_CAP = 6;

export type SynthesisResult =
  { ok: true; runId: string; mode: "live" | "mock"; items: number } | { ok: false; status: number; error: string };

type NewItem = {
  kind: "objective" | "completed" | "next_task" | "lesson";
  title: string;
  description: string;
  lesson_type: "methodology" | "evaluation_feedback" | "funding_feedback" | "blocker" | null;
  objective_status: "done" | "in_progress" | "not_started" | null;
  evidence: { file: string; page: number; quote: string }[];
};

function flatten(out: SynthesisOutput): NewItem[] {
  const base = { description: "", lesson_type: null, objective_status: null } as const;
  const nextTasks: NewItem[] = [
    ...out.next_tasks.map((t): NewItem => ({
      ...base,
      kind: "next_task",
      title: t.title,
      description: t.description,
      evidence: t.evidence,
    })),
    ...out.objectives
      .filter((o) => o.status !== "done")
      .map((o): NewItem => ({
        ...base,
        kind: "next_task",
        title: o.title,
        description: "",
        evidence: o.evidence,
      })),
  ];
  const materials: NewItem[] = [
    ...out.lessons.map((l): NewItem => ({
      ...base,
      kind: "lesson",
      title: l.text,
      lesson_type: l.type,
      evidence: l.evidence,
    })),
    ...out.completed.map((c): NewItem => ({
      ...base,
      kind: "lesson",
      title: c.description ? `${c.title} — ${c.description}` : c.title,
      lesson_type: "methodology",
      evidence: c.evidence,
    })),
  ];
  return [...nextTasks, ...materials];
}

function downgradeForImages(
  status: EvidenceStatus,
  evidence: { file_id: string }[],
  images: Set<string>,
): EvidenceStatus {
  return status === "matched" && evidence.some((e) => images.has(e.file_id)) ? "partial" : status;
}

/**
 * Runs one synthesis for a project. The CALLER must already have authorized the request
 * (a creator from the API route, or an admin retrying a failed run after writing the audit row).
 * `requestedBy` is the user the run counts against for the daily cap.
 */
export async function runSynthesis(
  projectId: string,
  requestedBy: string | null,
  locale: Locale = "id",
): Promise<SynthesisResult> {
  const t = await getTranslations({ locale, namespace: "synth" });
  const admin = createAdminClient();
  const settings = await getSettings();

  const { data: project } = await admin.from("projects").select("id, status, tech").eq("id", projectId).maybeSingle();
  if (!project) return { ok: false, status: 404, error: t("notFound") };
  if (!["draft", "unpublished"].includes(project.status)) {
    return { ok: false, status: 409, error: t("published") };
  }

  // Consent gate: never send private data to a model before every active team member consented.
  const { data: members } = await admin
    .from("project_members")
    .select("consented_at")
    .eq("project_id", projectId)
    .eq("status", "active");
  const teamDone = (members ?? []).length > 0 && (members ?? []).every((m) => m.consented_at);
  if (!teamDone) {
    return {
      ok: false,
      status: 409,
      error: t("needConsent"),
    };
  }

  // Rate limits: per user per day (setting), per project per hour.
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const cap = settings.synthesis_daily_cap.value;
  const [userCount, projectCount] = await Promise.all([
    requestedBy
      ? admin
          .from("synthesis_runs")
          .select("id", { count: "exact", head: true })
          .eq("requested_by", requestedBy)
          .gte("created_at", since(86_400_000))
      : Promise.resolve({ count: 0 }),
    admin
      .from("synthesis_runs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .gte("created_at", since(3_600_000)),
  ]);
  if ((userCount.count ?? 0) >= cap) return { ok: false, status: 429, error: t("dailyLimit", { cap }) };
  if ((projectCount.count ?? 0) >= PROJECT_HOURLY_CAP) {
    return { ok: false, status: 429, error: t("hourlyLimit") };
  }

  // A cap on the whole platform per day, so a burst of use cannot run up the bill (live AI only; mock costs nothing).
  if (getConfig().mode === "live") {
    const globalCap = globalSynthesisCap();
    const { count } = await admin
      .from("synthesis_runs")
      .select("id", { count: "exact", head: true })
      .eq("mode", "live")
      .gte("created_at", since(86_400_000));
    if ((count ?? 0) >= globalCap) {
      // Tell the team once a day, not on every refused click.
      if (
        await allow({
          scope: "alert-global-cap",
          identity: new Date().toISOString().slice(0, 10),
          max: 1,
          windowSeconds: 86_400,
        })
      )
        await alert("synthesis_cap", "The platform-wide daily limit for AI runs was reached.", { cap: globalCap });
      return { ok: false, status: 429, error: t("globalLimit") };
    }
  }

  const { data: fileRows } = await admin
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at");
  const files = ((fileRows ?? []) as ProjectFile[]).filter((f) => f.extracted_text_path);
  if (files.length === 0) return { ok: false, status: 400, error: t("noFiles") };

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
  if (docs.length === 0) return { ok: false, status: 400, error: t("unreadable") };

  const config = getConfig();
  const inputHash = createHash("sha256")
    .update(docs.map((d) => d.fileName + d.pages.map((p) => p.text).join("\n")).join("\n--\n"))
    .digest("hex");
  const { data: run, error: runError } = await admin
    .from("synthesis_runs")
    .insert({
      project_id: projectId,
      provider: config.provider,
      model: config.model,
      mode: config.mode,
      status: "running",
      input_hash: inputHash,
      requested_by: requestedBy,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (runError || !run) return { ok: false, status: 500, error: t("startFailed") };

  try {
    // Pictures have no text until the AI reads them. This is after the consent and rate limit checks above.
    const upload = await getTranslations({ locale, namespace: "upload" });
    await readPendingImages(files, docsById, config, (code) => upload(`note.${code}`));
    const images = new Set(files.filter((f) => f.kind === "image").map((f) => f.id));
    if (images.size > 0 && docs.every((d) => d.pages.every((p) => p.text.trim() === ""))) {
      throw new SynthesisError(config.mode === "mock" ? t("imagesNeedLiveAi") : t("imagesUnread"));
    }
    const output = await synthesize(docs, config, undefined, locale);
    const idByName = new Map(files.map((f) => [f.original_name, f.id]));
    const pagesByFile = new Map<string, Map<number, string>>();
    for (const f of files) {
      const d = docsById.get(f.id);
      if (d) pagesByFile.set(f.id, new Map(d.pages.map((p) => [p.page, p.text])));
    }

    // Replace earlier AI items so a fresh Gemini run cleanly replaces previous drafts.
    await admin.from("draft_items").delete().eq("project_id", projectId).eq("origin", "ai");
    const { data: existing } = await admin.from("draft_items").select("title, position").eq("project_id", projectId);
    const known = new Set((existing ?? []).map((e) => normalize(e.title)));
    let position = Math.max(0, ...(existing ?? []).map((e) => e.position)) + 1;

    const rows = [];
    for (const item of flatten(output)) {
      if (known.has(normalize(item.title))) continue;
      known.add(normalize(item.title));
      const evidence = item.evidence
        .map((e) => ({ file_id: idByName.get(e.file) ?? "", page: e.page, quote: e.quote }))
        .filter((e) => e.file_id);
      rows.push({
        project_id: projectId,
        run_id: run.id,
        kind: item.kind,
        title: item.title.slice(0, 300),
        description: item.description.slice(0, 600),
        lesson_type: item.lesson_type,
        objective_status: item.objective_status,
        evidence,
        // A quote from a picture is only checked against the AI's own reading of it, so it is never "matched".
        evidence_status: downgradeForImages(checkItemEvidence(evidence, pagesByFile), evidence, images),
        origin: "ai",
        review_status: "kept",
        position: position++,
      });
    }
    if (rows.length > 0) {
      const { error } = await admin.from("draft_items").insert(rows);
      if (error) throw new SynthesisError("The draft could not be saved.", "saveFailed");
    }
    const projectPatch: { summary?: string; tech?: string[] } = {};
    if (output.summary.trim().length >= 20) {
      projectPatch.summary = output.summary.trim();
    }
    if (output.tech.length > 0) {
      const mergedTech = [...new Set([...((project.tech as string[]) ?? []), ...output.tech])].slice(0, 15);
      projectPatch.tech = mergedTech;
    }
    if (Object.keys(projectPatch).length > 0) {
      await admin.from("projects").update(projectPatch).eq("id", projectId);
    }
    await admin
      .from("synthesis_runs")
      .update({ status: "done", finished_at: new Date().toISOString(), summary_draft: output.summary })
      .eq("id", run.id);
    return { ok: true, runId: run.id, mode: config.mode, items: rows.length };
  } catch (e) {
    // The run keeps the technical reason. The person sees plain words in their own language.
    const known = e instanceof SynthesisError ? e : null;
    await admin
      .from("synthesis_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: known?.message ?? "Unexpected error." })
      .eq("id", run.id);
    const code = known ? known.code : "failed";
    return { ok: false, status: 502, error: code ? t(`error.${code}`) : known!.message };
  }
}
