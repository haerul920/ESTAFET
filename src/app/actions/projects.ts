"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { fieldErrorsFrom, formValues, emailSchema, type FormState } from "@/lib/validation";
import { dbErrorMessage } from "@/lib/errors";
import type { TFn } from "@/lib/labels";
import { generateToken, hashToken, tokenExpiry } from "@/lib/token";
import { getOwnedProject } from "@/lib/db/owner";
import { getSettings } from "@/lib/settings";

/** Translators for the namespaces the actions use. */
async function tr() {
  const [v, a, e] = await Promise.all([getTranslations("validation"), getTranslations("actions"), getTranslations("errors")]);
  return { v: v as unknown as TFn, a: a as unknown as TFn, e: e as unknown as TFn };
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
    // Optional: a project without a supervising lecturer declares that on the Consent step instead.
    advisor_name: z.string().trim().max(120, v("advisorNameMax")).optional(),
    advisor_email: z.union([z.literal(""), emailSchema(v)]).optional(),
  });
}

/** Step 1. Creates the draft on first save, updates it afterwards, then moves to the Consent step. */
export async function saveBasics(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await tr();
  const locale = await getLocale();
  const values = formValues(formData);
  const user = await requireUser("/bagikan");
  const parsed = basicsSchema(t.v).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values, error: t.v("fixAndSave") };

  const supabase = await createClient();
  const input = {
    ...parsed.data,
    stopped_note: parsed.data.stopped_note ?? "",
    advisor_name: parsed.data.advisor_name ?? "",
    advisor_email: parsed.data.advisor_email ?? "",
  };
  const id = values.id;

  if (id) {
    const project = await getOwnedProject(id);
    if (!project) return { error: t.a("notOwnerEdit"), values };
    const { error } = await supabase.from("projects").update(input).eq("id", id);
    if (error) return { error: t.a("saveLocked"), values };
    revalidatePath(`/bagikan/${id}`, "layout");
    redirect({ href: `/bagikan/${id}/tim`, locale });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...input, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) {
    if (!user.verified) return { error: t.a("verifyFirst"), values };
    return { error: t.a("draftFailed"), values };
  }
  redirect({ href: `/bagikan/${data.id}/tim`, locale });
}

/** Invite a co-owner by the email of an existing ESTAFET account. They become a member only when they accept. */
export async function inviteCoOwner(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await tr();
  const projectId = String(formData.get("project_id") ?? "");
  const email = emailSchema(t.v).safeParse(formData.get("email"));
  if (!email.success) return { fieldErrors: { email: t.v("email") } };
  await requireUser(`/bagikan/${projectId}/tim`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_co_owner", { p_project_id: projectId, p_email: email.data });
  if (error) return { fieldErrors: { email: dbErrorMessage(t.e, error) } };
  revalidatePath(`/bagikan/${projectId}/tim`);
  return { ok: true, message: t.a("inviteSent") };
}

/** The invited person accepts or declines. */
export async function respondToInvite(projectId: string, accept: boolean): Promise<{ error?: string }> {
  const t = await tr();
  await requireUser("/dasbor");
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_co_owner_invite", { p_project_id: projectId, p_accept: accept });
  if (error) return { error: dbErrorMessage(t.e, error) };
  revalidatePath("/dasbor");
  return {};
}

/** The project has no supervising lecturer. Publishing then needs this declaration instead of an advisor approval. */
export async function declareNoAdvisor(projectId: string): Promise<{ error?: string }> {
  const t = await tr();
  await requireUser(`/bagikan/${projectId}/tim`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("declare_no_advisor", { p_project_id: projectId });
  if (error) return { error: dbErrorMessage(t.e, error) };
  revalidatePath(`/bagikan/${projectId}`, "layout");
  return {};
}

/** Records that the signed-in user accepted the current Terms and Privacy Policy. */
export async function acceptPolicies(projectId?: string): Promise<{ error?: string }> {
  const t = await tr();
  await requireUser(projectId ? `/bagikan/${projectId}/terbit` : "/dasbor");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_current_policies");
  if (error) return { error: dbErrorMessage(t.e, error) };
  if (projectId) revalidatePath(`/bagikan/${projectId}`, "layout");
  return {};
}

export async function removeTeamMember(projectId: string, profileId: string) {
  await requireUser(`/bagikan/${projectId}/tim`);
  const supabase = await createClient();
  await supabase.rpc("remove_team_member", { p_project_id: projectId, p_profile: profileId });
  revalidatePath(`/bagikan/${projectId}/tim`);
}

export async function confirmTeamConsent(projectId: string) {
  const t = await tr();
  await requireUser(`/bagikan/${projectId}/tim`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_team_consent", { p_project_id: projectId });
  if (error) return { error: dbErrorMessage(t.e, error) };
  revalidatePath(`/bagikan/${projectId}`, "layout");
  revalidatePath("/dasbor");
  return { ok: true };
}

/**
 * Creates a fresh private advisor link (replacing any pending one). The token is shown once and only
 * its hash is stored. Sending the link is up to the owner: ESTAFET does not send email for this yet.
 */
export async function createConsentLink(projectId: string): Promise<{ url?: string; error?: string }> {
  const t = await tr();
  const locale = await getLocale();
  await requireUser(`/bagikan/${projectId}/tim`);
  const project = await getOwnedProject(projectId);
  if (!project) return { error: t.a("notOwnerConsent") };
  if (!project.advisor_name || !project.advisor_email) return { error: t.a("advisorFirst") };

  const token = generateToken();
  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_advisor_consent", {
    p_project_id: projectId,
    p_token_hash: hashToken(token),
    p_expires_at: tokenExpiry(new Date(), (await getSettings()).advisor_token_ttl_days.value).toISOString(),
  });
  if (error) return { error: dbErrorMessage(t.e, error) };
  revalidatePath(`/bagikan/${projectId}`, "layout");
  const base = process.env.APP_URL ?? "http://localhost:3000";
  // The advisor opens the link in the language of the person who created it.
  return { url: `${base}${locale === "id" ? "" : `/${locale}`}/consent/${token}` };
}

export async function deleteFile(projectId: string, fileId: string): Promise<{ error?: string }> {
  const t = await tr();
  await requireUser(`/bagikan/${projectId}/berkas`);
  const project = await getOwnedProject(projectId);
  if (!project) return { error: t.a("notOwnerEdit") };
  if (!["draft", "unpublished"].includes(project.status)) return { error: t.a("filesLocked") };

  const supabase = await createClient();
  const { data: file } = await supabase.from("project_files").select("*").eq("id", fileId).eq("project_id", projectId).maybeSingle();
  if (!file) return { error: t.a("fileNotFound") };

  const admin = createAdminClient();
  if (file.storage_path) await admin.storage.from("project-files").remove([file.storage_path]);
  if (file.extracted_text_path) await admin.storage.from("extracted-text").remove([file.extracted_text_path]);

  // Items that cited this file can no longer be checked: mark their evidence as not found.
  const { data: items } = await admin.from("draft_items").select("id, evidence").eq("project_id", projectId);
  for (const it of items ?? []) {
    if ((it.evidence as { file_id: string }[]).some((e) => e.file_id === fileId)) {
      await admin.from("draft_items").update({ evidence_status: "not_found" }).eq("id", it.id);
    }
  }
  await admin.from("project_files").delete().eq("id", fileId);
  revalidatePath(`/bagikan/${projectId}/berkas`);
  return {};
}

export async function publishProject(projectId: string): Promise<{ error?: string }> {
  const t = await tr();
  const locale = await getLocale();
  await requireUser(`/bagikan/${projectId}/terbit`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_project", { p_project_id: projectId });
  if (error) return { error: dbErrorMessage(t.e, error) };
  const { data } = await supabase.from("projects").select("slug").eq("id", projectId).single();
  revalidatePath("/explore");
  revalidatePath("/dasbor");
  redirect({ href: `/projects/${data?.slug ?? ""}`, locale });
}

export async function applyDraftSummary(projectId: string, summary: string): Promise<{ error?: string }> {
  const t = await tr();
  await requireUser(`/bagikan/${projectId}/tinjau`);
  const trimmed = summary.trim().slice(0, 700);
  if (trimmed.length < 30) return { error: t.a("summaryTooShort") };
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ summary: trimmed }).eq("id", projectId);
  if (error) return { error: t.a("summaryFailed") };
  revalidatePath(`/bagikan/${projectId}/tinjau`);
  return {};
}
