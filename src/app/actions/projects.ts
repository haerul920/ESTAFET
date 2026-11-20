"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { fieldErrorsFrom, formValues, emailSchema, type FormState } from "@/lib/validation";
import { generateToken, hashToken, tokenExpiry } from "@/lib/token";
import { getCreatorProject } from "@/lib/db/creator";
import { getSettings } from "@/lib/settings";

const basicsSchema = z.object({
  title: z.string().trim().min(3, "Give the project a title of at least 3 characters.").max(120, "Keep the title under 120 characters."),
  summary: z
    .string()
    .trim()
    .min(30, "Write at least a couple of sentences (30 characters) so visitors understand the project.")
    .max(700, "Keep the summary under 700 characters."),
  kind: z.enum(["student_program", "hackathon", "research"], { message: "Choose the type of work." }),
  field: z.string().trim().min(2, "Choose the faculty or field."),
  year: z.coerce.number().int().min(2015, "Enter a year from 2015.").max(new Date().getFullYear() + 1, "That year is in the future."),
  stop_reason: z.enum(["funding_not_granted", "team_graduated", "time_or_people", "other"], { message: "Choose why the project stopped." }),
  stopped_note: z.string().trim().max(400, "Keep this note under 400 characters.").optional(),
  advisor_name: z.string().trim().min(2, "Enter your advisor's name."),
  advisor_email: emailSchema,
});

/** Step 1. Creates the draft on first save, updates it afterwards, then moves to the Consent step. */
export async function saveBasics(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const user = await requireUser("/share");
  const parsed = basicsSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values, error: "Fix the highlighted fields and save again." };

  const supabase = await createClient();
  const input = { ...parsed.data, stopped_note: parsed.data.stopped_note ?? "" };
  const id = values.id;

  if (id) {
    const project = await getCreatorProject(id);
    if (!project) return { error: "You can only edit your own projects.", values };
    const { error } = await supabase.from("projects").update(input).eq("id", id);
    if (error) return { error: "We could not save your changes. They may be locked because the project is already published.", values };
    revalidatePath(`/share/${id}`, "layout");
    redirect(`/share/${id}/consent`);
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...input, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { error: "We could not create your draft. Please try again.", values };
  redirect(`/share/${data.id}/consent`);
}

/** Add a teammate (creator) by the email of an existing ESTAFET account. */
export async function addTeamMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const projectId = String(formData.get("project_id") ?? "");
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { fieldErrors: { email: "Enter a valid email address." } };
  await requireUser(`/share/${projectId}/consent`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_team_member", { p_project_id: projectId, p_email: email.data });
  if (error) return { fieldErrors: { email: error.message } };
  revalidatePath(`/share/${projectId}/consent`);
  return { ok: true, message: "Teammate added. They confirm on their own dashboard." };
}

export async function removeTeamMember(projectId: string, profileId: string) {
  await requireUser(`/share/${projectId}/consent`);
  const supabase = await createClient();
  await supabase.rpc("remove_team_member", { p_project_id: projectId, p_profile: profileId });
  revalidatePath(`/share/${projectId}/consent`);
}

export async function confirmTeamConsent(projectId: string) {
  await requireUser(`/share/${projectId}/consent`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_team_consent", { p_project_id: projectId });
  if (error) return { error: error.message };
  revalidatePath(`/share/${projectId}`, "layout");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Creates a fresh private advisor link (replacing any pending one). The token is shown once and only
 * its hash is stored. Sending the link is up to the creator: ESTAFET does not send email.
 */
export async function createConsentLink(projectId: string): Promise<{ url?: string; error?: string }> {
  await requireUser(`/share/${projectId}/consent`);
  const project = await getCreatorProject(projectId);
  if (!project) return { error: "You can only request approval for your own projects." };
  if (!project.advisor_name || !project.advisor_email) return { error: "Add your advisor's name and email in step 1 first." };

  const token = generateToken();
  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_advisor_consent", {
    p_project_id: projectId,
    p_token_hash: hashToken(token),
    p_expires_at: tokenExpiry(new Date(), (await getSettings()).advisor_token_ttl_days.value).toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath(`/share/${projectId}`, "layout");
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return { url: `${base}/consent/${token}` };
}

export async function deleteFile(projectId: string, fileId: string): Promise<{ error?: string }> {
  await requireUser(`/share/${projectId}/files`);
  const project = await getCreatorProject(projectId);
  if (!project) return { error: "You can only change your own projects." };
  if (!["draft", "awaiting_advisor", "verifying"].includes(project.status)) return { error: "Published projects cannot lose files." };

  const supabase = await createClient();
  const { data: file } = await supabase.from("project_files").select("*").eq("id", fileId).eq("project_id", projectId).maybeSingle();
  if (!file) return { error: "File not found." };

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
  revalidatePath(`/share/${projectId}/files`);
  return {};
}

export async function publishProject(projectId: string): Promise<{ error?: string }> {
  await requireUser(`/share/${projectId}/publish`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_project", { p_project_id: projectId });
  if (error) return { error: error.message };
  const { data } = await supabase.from("projects").select("slug").eq("id", projectId).single();
  revalidatePath("/explore");
  revalidatePath("/dashboard");
  redirect(`/projects/${data?.slug ?? ""}`);
}

export async function applyDraftSummary(projectId: string, summary: string): Promise<{ error?: string }> {
  await requireUser(`/share/${projectId}/verify`);
  const trimmed = summary.trim().slice(0, 700);
  if (trimmed.length < 30) return { error: "The drafted summary is too short to use." };
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ summary: trimmed }).eq("id", projectId);
  if (error) return { error: "Could not update the summary." };
  revalidatePath(`/share/${projectId}/verify`);
  return {};
}
