import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AdvisorConsent,
  AdvisorMode,
  DraftItem,
  Project,
  ProjectFile,
  ProjectMember,
  SynthesisRun,
} from "./types";
import type { ExtractedDoc } from "@/lib/ingest/types";
import { locateQuote } from "@/lib/evidence/match";

export interface SourceView {
  file: string;
  pageLabel: string;
  found: boolean;
  before: string;
  quote: string;
  after: string;
  /** Plain context shown when the quote could not be found on the cited page. */
  context: string;
  fileMissing: boolean;
}

export interface PublishChecklist {
  /** Active members only. People who were invited but have not accepted do not count. */
  team: { confirmed: number; total: number; done: boolean };
  advisor: { status: AdvisorConsent["status"] | "none" | "not_needed"; done: boolean; expiresAt: string | null; mode: AdvisorMode };
  review: { reviewed: number; total: number; kept: number; done: boolean };
  policies: { done: boolean };
  canPublish: boolean;
}

/** The project row if the signed-in user is one of its owners (RLS + membership), otherwise null. */
export async function getOwnedProject(id: string): Promise<Project | null> {
  const supabase = await createClient();
  const { data: ok } = await supabase.rpc("is_project_owner", { pid: id });
  if (ok !== true) return null;
  const { data } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  return (data as Project | null) ?? null;
}

/** Active owners and pending invitations, oldest first. */
export async function getTeam(projectId: string): Promise<(ProjectMember & { full_name: string })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("project_id, profile_id, role, status, consented_at")
    .eq("project_id", projectId)
    .in("status", ["active", "invited"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ProjectMember[];
  const ids = rows.map((r) => r.profile_id);
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  const names = new Map((profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
  return rows.map((r) => ({ ...r, full_name: names.get(r.profile_id) ?? "Team member" }));
}

export async function getLatestConsent(projectId: string): Promise<AdvisorConsent | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("advisor_consents")
    .select("id, project_id, status, comment, expires_at, decided_at, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as AdvisorConsent[];
  return rows.find((r) => r.status === "approved") ?? rows[0] ?? null;
}

export async function getFiles(projectId: string): Promise<ProjectFile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectFile[];
}

export async function getItems(projectId: string): Promise<DraftItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("draft_items")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DraftItem[];
}

export async function getLatestRun(projectId: string): Promise<(SynthesisRun & { summary_draft: string | null }) | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("synthesis_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as (SynthesisRun & { summary_draft: string | null }) | null) ?? null;
}

export function buildChecklist(
  team: { consented_at: string | null; status?: string }[],
  consent: AdvisorConsent | null,
  items: DraftItem[],
  extra: { advisorMode: AdvisorMode; noAdvisorDeclared: boolean; policiesAccepted: boolean } = {
    advisorMode: "advisor",
    noAdvisorDeclared: false,
    policiesAccepted: true,
  },
): PublishChecklist {
  const active = team.filter((m) => (m.status ?? "active") === "active");
  const confirmed = active.filter((m) => m.consented_at).length;
  const reviewed = items.filter((i) => i.review_status !== "pending").length;
  const kept = items.filter((i) => i.review_status === "kept").length;
  const teamDone = active.length > 0 && confirmed === active.length;
  const noAdvisor = extra.advisorMode === "none" && extra.noAdvisorDeclared;
  const advisorDone = noAdvisor || (extra.advisorMode === "advisor" && consent?.status === "approved");
  const reviewDone = items.length > 0 && reviewed === items.length && kept > 0;
  return {
    team: { confirmed, total: active.length, done: teamDone },
    advisor: {
      status: noAdvisor ? "not_needed" : (consent?.status ?? "none"),
      done: advisorDone,
      expiresAt: consent?.expires_at ?? null,
      mode: extra.advisorMode,
    },
    review: { reviewed, total: items.length, kept, done: reviewDone },
    policies: { done: extra.policiesAccepted },
    canPublish: teamDone && advisorDone && reviewDone && extra.policiesAccepted,
  };
}

/** Reads the extracted text of the project's files (service role, after the caller checked access). */
export async function loadExtractedDocs(files: ProjectFile[]): Promise<Map<string, ExtractedDoc>> {
  const admin = createAdminClient();
  const out = new Map<string, ExtractedDoc>();
  for (const f of files) {
    if (!f.extracted_text_path) continue;
    const { data, error } = await admin.storage.from("extracted-text").download(f.extracted_text_path);
    if (error || !data) continue;
    try {
      out.set(f.id, JSON.parse(await data.text()) as ExtractedDoc);
    } catch {
      // unreadable extraction: the item will show "source missing"
    }
  }
  return out;
}

/** Builds the right-hand "source viewer" content for every item, using only the cited page. */
export async function buildSourceViews(items: DraftItem[], files: ProjectFile[]): Promise<Record<string, SourceView>> {
  const docs = await loadExtractedDocs(files);
  const fileById = new Map(files.map((f) => [f.id, f]));
  const out: Record<string, SourceView> = {};
  for (const item of items) {
    const ev = item.evidence[0];
    if (!ev) {
      out[item.id] = { file: "No source", pageLabel: "", found: false, before: "", quote: "", after: "", context: "", fileMissing: true };
      continue;
    }
    const file = fileById.get(ev.file_id);
    const doc = docs.get(ev.file_id);
    const page = doc?.pages.find((p) => p.page === ev.page);
    const pageLabel = file?.kind === "markdown" ? `section ${ev.page}` : `page ${ev.page}`;
    if (!file || !doc || !page) {
      out[item.id] = { file: file?.original_name ?? "Removed file", pageLabel, found: false, before: "", quote: ev.quote, after: "", context: "", fileMissing: true };
      continue;
    }
    const loc = ev.quote ? locateQuote(ev.quote, page.text) : null;
    out[item.id] = loc
      ? { file: file.original_name, pageLabel, found: true, before: loc.before, quote: loc.match, after: loc.after, context: "", fileMissing: false }
      : {
          file: file.original_name,
          pageLabel,
          found: item.evidence_status !== "not_found",
          before: item.evidence_status === "partial" ? page.text.slice(0, 500) : "",
          quote: item.evidence_status === "partial" ? "" : ev.quote,
          after: "",
          context: page.text.slice(0, 500),
          fileMissing: false,
        };
  }
  return out;
}

/** The step the wizard should resume at, based on what is already done (not on a stored status). */
export function resumeStep(project: Pick<Project, "status" | "title" | "summary">, hasFiles: boolean, hasItems: boolean): string {
  if (project.status !== "draft") return "publish";
  if (!project.title || !project.summary) return "basics";
  if (hasItems) return "verify";
  return hasFiles ? "files" : "consent";
}
