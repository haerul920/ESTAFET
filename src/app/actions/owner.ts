"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/errors";
import { fieldErrorsFrom } from "@/lib/validation";
import type { TFn } from "@/lib/labels";

async function tr() {
  const [v, a, e] = await Promise.all([getTranslations("validation"), getTranslations("actions"), getTranslations("errors")]);
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
    summary: z.string().trim().min(30, v("summaryMin")).max(700, v("summaryMax")),
    kind: z.enum(["student_program", "hackathon", "research"], { message: v("kind") }),
    field: z.string().trim().min(2, v("field")),
    year: z.coerce.number().int().min(2015, v("yearMin")).max(new Date().getFullYear() + 1, v("yearMax")),
    stop_reason: z.enum(["funding_not_granted", "team_graduated", "time_or_people", "other"], { message: v("stopReason") }),
    stopped_note: z.string().trim().max(400, v("stoppedNoteMax")).optional(),
  });
}

/**
 * Autosave for the Info step. It only writes when every field is valid, so a half-typed form never overwrites a good
 * draft. A project that does not exist yet is created by the normal "Save and continue" (saveBasics).
 */
export async function autosaveBasics(projectId: string, values: Record<string, string>): Promise<{ saved: boolean; fieldErrors?: Record<string, string> }> {
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
export async function saveAccessSettings(projectId: string, mode: "open" | "by_request" | "paused", max: number | null): Promise<Result> {
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

async function lifecycle(projectId: string, fn: "unpublish_project" | "publish_project" | "archive_project"): Promise<Result> {
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
