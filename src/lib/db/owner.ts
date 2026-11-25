import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DraftItem, Project, ProjectFile, ProjectMember, SynthesisRun } from "./types";
import type { ExtractedDoc } from "@/lib/ingest/types";
import { locateQuote } from "@/lib/evidence/match";
import { refKind } from "@/lib/ingest/ref";

export interface SourceView {
  file: string;
  pageLabel: string;
  /** The cited file is a picture, so the quote comes from the AI's own reading of it. */
  fromImage?: boolean;
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

/**
 * Claims any pending email team invitations matching this signed-in user's email address,
 * turning them into `project_members` rows (`status = 'invited'`) and `team_invite` notifications.
 */
export async function claimPendingTeamInvites(userId: string, email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!userId || !normalized) return;
  try {
    const admin = createAdminClient();
    const { data: pending, error } = await admin
      .from("pending_team_invites")
      .select("id, project_id, invited_by, created_at")
      .ilike("email", normalized);
    if (error || !pending || pending.length === 0) return;

    const projectIds = [...new Set(pending.map((p: { project_id: string }) => p.project_id))];
    const { data: projects } = await admin.from("projects").select("id, title").in("id", projectIds);
    const titleById = new Map((projects ?? []).map((p: { id: string; title: string }) => [p.id, p.title]));

    for (const row of pending as {
      id: string;
      project_id: string;
      invited_by: string | null;
      created_at: string;
    }[]) {
      const { data: existing } = await admin
        .from("project_members")
        .select("status")
        .eq("project_id", row.project_id)
        .eq("profile_id", userId)
        .maybeSingle();

      if (!existing) {
        await admin.from("project_members").insert({
          project_id: row.project_id,
          profile_id: userId,
          role: "co_owner",
          status: "invited",
          invited_by: row.invited_by,
          invited_at: row.created_at,
          consented_at: null,
        });
        await admin.from("notifications").insert({
          user_id: userId,
          type: "team_invite",
          payload: {
            project_id: row.project_id,
            title: titleById.get(row.project_id) ?? "",
          },
        });
      }
      await admin.from("pending_team_invites").delete().eq("id", row.id);
    }
  } catch {
    // Table may not exist yet in older local schemas; ignore gracefully.
  }
}

/** Active owners and pending invitations (including email invites awaiting account creation), oldest first. */
export async function getTeam(
  projectId: string,
): Promise<(ProjectMember & { full_name: string; pending_email?: string })[]> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("project_id, profile_id, role, status, consented_at")
    .eq("project_id", projectId)
    .in("status", ["active", "invited"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ProjectMember[];
  const ids = rows.map((r) => r.profile_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
  const members: (ProjectMember & { full_name: string; pending_email?: string })[] = rows.map((r) => ({
    ...r,
    full_name: names.get(r.profile_id) ?? "Team member",
  }));

  try {
    const { data: pendingEmails } = await admin
      .from("pending_team_invites")
      .select("email")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    for (const inv of (pendingEmails ?? []) as { email: string }[]) {
      members.push({
        project_id: projectId,
        profile_id: `email:${inv.email}`,
        role: "co_owner",
        status: "invited",
        consented_at: null,
        full_name: inv.email,
        pending_email: inv.email,
      });
    }
  } catch {
    // Ignore if pending_team_invites table is not migrated yet.
  }

  return members;
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

export async function getLatestRun(
  projectId: string,
): Promise<(SynthesisRun & { summary_draft: string | null }) | null> {
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
  items: DraftItem[],
  extra: { policiesAccepted: boolean } = { policiesAccepted: true },
): PublishChecklist {
  const active = team.filter((m) => (m.status ?? "active") === "active");
  const confirmed = active.filter((m) => m.consented_at).length;
  // Removed items are gone for the owner, so they are not counted anywhere.
  const shown = items.filter((i) => i.review_status !== "removed");
  const reviewed = shown.filter((i) => i.review_status !== "pending").length;
  const kept = shown.filter((i) => i.review_status === "kept").length;
  const teamDone = active.length > 0 && confirmed === active.length;
  const reviewDone = shown.length > 0 && reviewed === shown.length && kept > 0;
  return {
    team: { confirmed, total: active.length, done: teamDone },
    review: { reviewed, total: shown.length, kept, done: reviewDone },
    policies: { done: extra.policiesAccepted },
    canPublish: teamDone && reviewDone && extra.policiesAccepted,
  };
}

/** Reads the extracted text of the project's files (service role, after the caller checked access). */
async function loadExtractedDocs(files: ProjectFile[]): Promise<Map<string, ExtractedDoc>> {
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
      out[item.id] = {
        file: "No source",
        pageLabel: "",
        found: false,
        before: "",
        quote: "",
        after: "",
        context: "",
        fileMissing: true,
      };
      continue;
    }
    const file = fileById.get(ev.file_id);
    const doc = docs.get(ev.file_id);
    const page = doc?.pages.find((p) => p.page === ev.page);
    const pageLabel = `${refKind(file?.kind)} ${ev.page}`;
    // Words "found" in a picture were read from it by the AI, so people are told to compare with the picture.
    const fromImage = file?.kind === "image";
    if (!file || !doc || !page) {
      out[item.id] = {
        file: file?.original_name ?? "Removed file",
        pageLabel,
        fromImage,
        found: false,
        before: "",
        quote: ev.quote,
        after: "",
        context: "",
        fileMissing: true,
      };
      continue;
    }
    const loc = ev.quote ? locateQuote(ev.quote, page.text) : null;
    out[item.id] = loc
      ? {
          file: file.original_name,
          pageLabel,
          fromImage,
          found: true,
          before: loc.before,
          quote: loc.match,
          after: loc.after,
          context: "",
          fileMissing: false,
        }
      : {
          file: file.original_name,
          pageLabel,
          fromImage,
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
export function resumeStep(
  project: Pick<Project, "status" | "title" | "field"> & { fill_mode?: "ai" | "manual" | null },
  hasFiles: boolean,
  hasItems: boolean,
): string {
  if (project.status !== "draft") return "terbit";
  if (!project.title || !project.field) return "info";
  // Items exist (AI draft or written by hand): keep reviewing them. Otherwise start at the files, or at the manual path.
  if (hasItems || project.fill_mode === "manual") return "tinjau";
  return "berkas";
}
