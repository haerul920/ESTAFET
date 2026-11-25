"use server";

import { PROJECT_KINDS } from "@/lib/db/types";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/errors";
import { fieldErrorsFrom } from "@/lib/validation";
import type { TFn } from "@/lib/labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiRemovalPatch } from "@/lib/db/ai-draft";
import { getOwnedProject } from "@/lib/db/owner";
import { log } from "@/lib/log";
import { forgetImageReadings } from "@/lib/ingest/image-readings";

async function tr() {
  const [v, a, e] = await Promise.all([
    getTranslations("validation"),
    getTranslations("actions"),
    getTranslations("errors"),
  ]);
  return { v: v as unknown as TFn, a: a as unknown as TFn, e: e as unknown as TFn };
}

type Result = { error?: string };

/** The owner's choice on the Files step: write everything by hand ("manual") or use the AI draft ("ai"). */
export async function setFillMode(projectId: string, mode: "ai" | "manual"): Promise<Result> {
  const t = await tr();
  await requireUser(`/bagikan/${projectId}/berkas`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_fill_mode", { p_project_id: projectId, p_mode: mode });
  if (error) return { error: dbErrorMessage(t.e, error) };
  revalidatePath(`/bagikan/${projectId}`, "layout");
  return {};
}

function basicsSchema(v: TFn) {
  return z.object({
    title: z.string().trim().min(3, v("titleMin")).max(120, v("titleMax")),
    kind: z.enum(PROJECT_KINDS, { message: v("kind") }),
    field: z.string().trim().min(2, v("field")),
    year: z.coerce
      .number()
      .int()
      .min(2015, v("yearMin"))
      .max(new Date().getFullYear() + 1, v("yearMax")),
    stopped_note: z.string().trim().max(400, v("stoppedNoteMax")).optional(),
  });
}

/**
 * Autosave for the Info step. It only writes when every field is valid, so a half-typed form never overwrites a good
 * draft. A project that does not exist yet is created by the normal "Save and continue" (saveBasics).
 */
export async function autosaveBasics(
  projectId: string,
  values: Record<string, string>,
): Promise<{ saved: boolean; fieldErrors?: Record<string, string> }> {
  const t = await tr();
  await requireUser(`/bagikan/${projectId}/info`);
  const parsed = basicsSchema(t.v).safeParse(values);
  if (!parsed.success) return { saved: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const input = {
    ...parsed.data,
    stopped_note: parsed.data.stopped_note ?? "",
  };
  const { data, error } = await supabase.from("projects").update(input).eq("id", projectId).select("id");
  if (error || !data || data.length === 0) return { saved: false };
  return { saved: true };
}

/** Access mode and team limit (Team and access step, and the project settings). The database logs it in the lineage. */
export async function saveAccessSettings(
  projectId: string,
  mode: "open" | "by_request",
  max: number | null,
): Promise<Result> {
  const t = await tr();
  await requireUser(`/bagikan/${projectId}/tim`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_access_settings", { p_project_id: projectId, p_mode: mode, p_max: max });
  if (error) return { error: dbErrorMessage(t.e, error) };
  revalidatePath(`/bagikan/${projectId}`, "layout");
  revalidatePath("/dasbor");
  revalidatePath("/explore");
  return {};
}

async function lifecycle(
  projectId: string,
  fn: "unpublish_project" | "publish_project" | "archive_project",
): Promise<Result> {
  const t = await tr();
  await requireUser("/dasbor");
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_project_id: projectId });
  if (error) return { error: dbErrorMessage(t.e, error) };
  revalidatePath("/explore");
  revalidatePath("/dasbor");
  revalidatePath("/proyek", "layout");
  revalidatePath("/projects", "layout");
  return {};
}

export async function unpublishProject(projectId: string): Promise<Result> {
  return lifecycle(projectId, "unpublish_project");
}
/** Publishes an unpublished project again. The same requirements apply as the first time. */
export async function republishProject(projectId: string): Promise<Result> {
  return lifecycle(projectId, "publish_project");
}
export async function archiveProject(projectId: string): Promise<Result> {
  return lifecycle(projectId, "archive_project");
}

export async function proposeOwnership(projectId: string, toProfile: string): Promise<Result> {
  const t = await tr();
  await requireUser("/dasbor");
  const supabase = await createClient();
  const { error } = await supabase.rpc("propose_ownership_transfer", { p_project_id: projectId, p_to: toProfile });
  if (error) return { error: dbErrorMessage(t.e, error) };
  revalidatePath("/proyek", "layout");
  return {};
}

export async function respondOwnership(projectId: string, accept: boolean): Promise<Result> {
  const t = await tr();
  await requireUser("/dasbor");
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_ownership_transfer", { p_project_id: projectId, p_accept: accept });
  if (error) return { error: dbErrorMessage(t.e, error) };
  revalidatePath("/proyek", "layout");
  revalidatePath("/dasbor");
  return {};
}

export async function cancelOwnership(projectId: string): Promise<Result> {
  const t = await tr();
  await requireUser("/dasbor");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_ownership_transfer", { p_project_id: projectId });
  if (error) return { error: dbErrorMessage(t.e, error) };
  revalidatePath("/proyek", "layout");
  return {};
}

/**
 * "Save and exit" on the Info step. Every field that is valid is saved, so a half-filled draft is not lost. Fields
 * that are not valid yet are reported back and left as they were. Publishing stays blocked until the basics are in.
 * A new project needs at least a title.
 */
export async function saveDraftAndExit(
  projectId: string | null,
  values: Record<string, string>,
): Promise<{ error?: string; id: string | null; skipped: string[] }> {
  const t = await tr();
  const user = await requireUser(projectId ? `/bagikan/${projectId}/info` : "/bagikan");
  const shape = basicsSchema(t.v).shape;
  const patch: Record<string, string | number> = {};
  const skipped: string[] = [];
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    const result = shape[key].safeParse(values[key]);
    if (!result.success) skipped.push(key);
    else if (result.data !== undefined) patch[key] = result.data;
  }
  const supabase = await createClient();

  if (projectId) {
    if (Object.keys(patch).length > 0) {
      const { data, error } = await supabase.from("projects").update(patch).eq("id", projectId).select("id");
      if (error || !data || data.length === 0) return { error: t.a("draftFailed"), id: projectId, skipped };
      revalidatePath(`/bagikan/${projectId}`, "layout");
      revalidatePath("/dasbor");
    }
    return { id: projectId, skipped };
  }

  if (skipped.includes("title")) return { id: null, skipped };
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...patch, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) {
    return { error: t.a(user.verified ? "draftFailed" : "verifyFirst"), id: null, skipped };
  }
  revalidatePath("/dasbor");
  return { id: data.id as string, skipped };
}

/**
 * Takes the AI back: everything the draft produced is deleted (items, its summary, its list of tools), the choice
 * between AI and manual is open again, and this owner's agreement that AI reads the files is withdrawn.
 * Items the owners wrote stay. Text already sent to the AI provider cannot be recalled.
 */
export async function cancelAiDraft(projectId: string): Promise<Result> {
  const t = await tr();
  const user = await requireUser(`/bagikan/${projectId}/berkas`);
  const project = await getOwnedProject(projectId);
  if (!project) return { error: t.a("notOwnerEdit") };
  // A public teaser is made of these items, so it has to be taken down first.
  if (project.status === "published" || project.status === "archived") return { error: t.a("cancelAiPublished") };

  const admin = createAdminClient();
  const failed = { error: t.a("cancelAiFailed") };
  // The agreement goes first, so that no new AI run can start while the rest is being removed.
  const consent = await admin
    .from("project_members")
    .update({ consented_at: null })
    .eq("project_id", projectId)
    .eq("profile_id", user.id);
  if (consent.error) return failed;
  const upload = await getTranslations("upload");
  if (!(await forgetImageReadings(projectId, upload("note.image_forgotten")))) return failed;
  const runs = await admin
    .from("synthesis_runs")
    .select("summary_draft")
    .eq("project_id", projectId)
    .eq("status", "done");
  if (runs.error) return failed;
  const items = await admin.from("draft_items").delete().eq("project_id", projectId).eq("origin", "ai");
  if (items.error) return failed;
  const patch = aiRemovalPatch(
    project.summary,
    (runs.data ?? []).map((r) => r.summary_draft as string | null),
  );
  const updated = await admin.from("projects").update(patch).eq("id", projectId);
  if (updated.error) return failed;
  const cleared = await admin.from("synthesis_runs").update({ summary_draft: null }).eq("project_id", projectId);
  if (cleared.error) return failed;

  revalidatePath(`/bagikan/${projectId}`, "layout");
  revalidatePath("/dasbor");
  return {};
}

/**
 * Deletes a draft for good. The database function checks who may do it and what may be deleted: only the main owner,
 * only a draft that was never published and that has no request, access or report. Stored files are removed after
 * the database step, so a refusal never costs a file.
 */
export async function deleteDraftProject(projectId: string): Promise<Result> {
  const t = await tr();
  await requireUser("/dasbor");
  if (!z.string().uuid().safeParse(projectId).success) return { error: t.e("generic") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_draft_project", { p_project: projectId });
  if (error) return { error: dbErrorMessage(t.e, error) };

  const paths = data as { originals: string[]; texts: string[] };
  const admin = createAdminClient();
  for (const [bucket, list] of [
    ["project-files", paths.originals],
    ["extracted-text", paths.texts],
  ] as const) {
    if (list.length === 0) continue;
    const removed = await admin.storage.from(bucket).remove(list);
    // The project is already gone. Leftover objects are private and are only counted here, never named.
    if (removed.error) log.error("draft_delete_storage_failed", { projectId, bucket, count: list.length });
  }
  revalidatePath("/dasbor");
  return {};
}
