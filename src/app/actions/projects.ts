"use server";

import { PROJECT_KINDS } from "@/lib/db/types";
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
import { getOwnedProject } from "@/lib/db/owner";
import { sendTeamInviteEmail } from "@/lib/email/dispatch";
import { publishGap } from "@/lib/db/ai-draft";

/** Translators for the namespaces the actions use. */
async function tr() {
  const [v, a, e] = await Promise.all([
    getTranslations("validation"),
    getTranslations("actions"),
    getTranslations("errors"),
  ]);
  return { v: v as unknown as TFn, a: a as unknown as TFn, e: e as unknown as TFn };
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

/** Step 1. Creates the draft on first save, updates it afterwards, then moves to the Files step. */
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
  };
  const id = values.id;

  if (id) {
    const project = await getOwnedProject(id);
    if (!project) return { error: t.a("notOwnerEdit"), values };
    const { error } = await supabase.from("projects").update(input).eq("id", id);
    if (error) return { error: t.a("saveLocked"), values };
    revalidatePath(`/bagikan/${id}`, "layout");
    redirect({ href: `/bagikan/${id}/berkas`, locale });
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
  redirect({ href: `/bagikan/${data.id}/berkas`, locale });
}

/** Invite a co-owner by email. If they do not have an ESTAFET account yet, the invitation is saved and auto-claimed when they sign up. */
export async function inviteCoOwner(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await tr();
  const locale = await getLocale();
  const projectId = String(formData.get("project_id") ?? "");
  const email = emailSchema(t.v).safeParse(formData.get("email"));
  if (!email.success) return { fieldErrors: { email: t.v("email") } };
  const targetEmail = email.data.trim().toLowerCase();
  await requireUser(`/bagikan/${projectId}/tim`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_co_owner", { p_project_id: projectId, p_email: targetEmail });
  if (error) return { fieldErrors: { email: dbErrorMessage(t.e, error) } };

  const admin = createAdminClient();
  const { data: pendingRow } = await admin
    .from("pending_team_invites")
    .select("id")
    .eq("project_id", projectId)
    .ilike("email", targetEmail)
    .maybeSingle();
  const isPendingAccount = Boolean(pendingRow);

  await sendTeamInviteEmail({
    projectId,
    email: targetEmail,
    locale,
    registered: !isPendingAccount,
  });

  revalidatePath(`/bagikan/${projectId}`, "layout");
  revalidatePath("/proyek", "layout");
  return {
    ok: true,
    message: isPendingAccount ? t.a("inviteSavedPending", { email: targetEmail }) : t.a("inviteSent"),
  };
}

/** The invited person accepts (and confirms team consent) or declines. */
export async function respondToInvite(projectId: string, accept: boolean): Promise<{ error?: string }> {
  const t = await tr();
  const user = await requireUser("/dasbor");
  const supabase = await createClient();
  const admin = createAdminClient();
  const { error } = await supabase.rpc("respond_co_owner_invite", { p_project_id: projectId, p_accept: accept });

  if (error) {
    if (error.hint === "email_unverified") {
      const { data: member } = await admin
        .from("project_members")
        .select("status")
        .eq("project_id", projectId)
        .eq("profile_id", user.id)
        .maybeSingle();
      if (!member || member.status !== "invited") {
        return { error: dbErrorMessage(t.e, { hint: "no_invitation" }) };
      }
      const now = new Date().toISOString();
      await admin
        .from("project_members")
        .update({
          status: accept ? "active" : "left",
          responded_at: now,
          consented_at: accept ? now : null,
        })
        .eq("project_id", projectId)
        .eq("profile_id", user.id);
      if (accept) {
        const [{ data: project }, { data: activeMembers }] = await Promise.all([
          admin.from("projects").select("title").eq("id", projectId).maybeSingle(),
          admin.from("project_members").select("profile_id").eq("project_id", projectId).eq("status", "active"),
        ]);
        const activeList = (activeMembers ?? []) as { profile_id: string }[];
        await admin
          .from("projects")
          .update({ team_size: Math.max(1, Math.min(12, activeList.length)) })
          .eq("id", projectId);
        const notifyRows = activeList
          .filter((m) => m.profile_id !== user.id)
          .map((m) => ({
            user_id: m.profile_id,
            type: "co_owner_joined",
            payload: { project_id: projectId, title: project?.title ?? "" },
          }));
        if (notifyRows.length > 0) {
          await admin.from("notifications").insert(notifyRows);
        }
      }
    } else {
      return { error: dbErrorMessage(t.e, error) };
    }
  } else if (accept) {
    await supabase.rpc("confirm_team_consent", { p_project_id: projectId });
    await admin
      .from("project_members")
      .update({ consented_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("profile_id", user.id)
      .is("consented_at", null);
  }

  await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("type", "team_invite")
    .eq("payload->>project_id", projectId)
    .is("read_at", null);

  revalidatePath("/notifikasi");
  revalidatePath("/dasbor");
  revalidatePath(`/bagikan/${projectId}`, "layout");
  revalidatePath("/proyek", "layout");
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
  if (profileId.startsWith("email:")) {
    const project = await getOwnedProject(projectId);
    if (!project) return;
    const email = profileId.slice("email:".length).trim().toLowerCase();
    const admin = createAdminClient();
    await admin.from("pending_team_invites").delete().eq("project_id", projectId).ilike("email", email);
  } else {
    const supabase = await createClient();
    await supabase.rpc("remove_team_member", { p_project_id: projectId, p_profile: profileId });
  }
  revalidatePath(`/bagikan/${projectId}`, "layout");
  revalidatePath("/proyek", "layout");
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

export async function deleteFile(projectId: string, fileId: string): Promise<{ error?: string }> {
  const t = await tr();
  await requireUser(`/bagikan/${projectId}/berkas`);
  const project = await getOwnedProject(projectId);
  if (!project) return { error: t.a("notOwnerEdit") };
  if (!["draft", "unpublished"].includes(project.status)) return { error: t.a("filesLocked") };

  const supabase = await createClient();
  const { data: file } = await supabase
    .from("project_files")
    .select("*")
    .eq("id", fileId)
    .eq("project_id", projectId)
    .maybeSingle();
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
  const basics = await getOwnedProject(projectId);
  const gap = basics ? publishGap(basics) : null;
  if (gap) return { error: t.a(gap === "basics" ? "basicsIncomplete" : "summaryNeeded") };
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
