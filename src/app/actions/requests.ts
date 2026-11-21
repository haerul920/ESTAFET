"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, fieldErrorsFrom, formValues, type FormState } from "@/lib/validation";

const requestSchema = z.object({
  project_id: z.string().uuid(),
  slug: z.string().min(1),
  team_name: z.string().trim().min(2, "Name your team (at least 2 characters).").max(60, "Keep the team name under 60 characters."),
  teammates: z.string().trim().min(1, "Add your teammates' university emails."),
  task_ids: z.array(z.string().uuid()).min(1, "Choose at least one verified task."),
  plan: z.string().trim().min(40, "Describe your first month in at least a couple of sentences (40 characters).").max(1500, "Keep the plan under 1500 characters."),
  purpose: z.enum(["competition", "research", "course", "other"], { message: "Choose what this is for." }),
  target_date: z
    .string()
    .min(1, "Pick a target date.")
    .refine((d) => !Number.isNaN(Date.parse(d)) && new Date(d) > new Date(), "Pick a date in the future."),
  fit_note: z.string().trim().max(600, "Keep this under 600 characters.").optional(),
  acknowledge: z.literal("on", { message: "You need to acknowledge the credit requirement." }),
});

export async function submitRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const slug = values.slug ?? "";
  const user = await requireUser(`/projects/${slug}/request`);
  const task_ids = formData.getAll("task_ids").map(String);
  const parsed = requestSchema.safeParse({ ...values, task_ids });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values, data: { task_ids }, error: "Fix the highlighted fields and send again." };
  }

  const emails = parsed.data.teammates
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const checked = emails.map((e) => emailSchema.safeParse(e));
  if (checked.some((c) => !c.success)) {
    return { fieldErrors: { teammates: "One of the emails is not valid. Separate emails with commas." }, values, data: { task_ids } };
  }
  const unique = [...new Set(emails)].filter((e) => e !== user.email.toLowerCase());
  if (unique.length < 2 || unique.length > 3) {
    return { fieldErrors: { teammates: "Teams have 3 to 4 members. List 2 or 3 teammates besides yourself." }, values, data: { task_ids } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_continuation_request", {
    p_project_id: parsed.data.project_id,
    p_team_name: parsed.data.team_name,
    p_members: unique.map((email) => ({ email })),
    p_task_ids: parsed.data.task_ids,
    p_plan: parsed.data.plan,
    p_purpose: parsed.data.purpose,
    p_target_date: parsed.data.target_date,
    p_fit_note: parsed.data.fit_note ?? "",
  });
  if (error || !data) return { error: error?.message ?? "Your request could not be sent.", values, data: { task_ids } };
  revalidatePath("/dasbor");
  redirect(`/requests/${data}`);
}

export async function decideRequest(requestId: string, decision: "approved" | "declined", note: string): Promise<{ error?: string }> {
  await requireUser(`/requests/${requestId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_request", { p_request_id: requestId, p_decision: decision, p_note: note });
  if (error) return { error: error.message };
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/dasbor");
  return {};
}

export async function askQuestion(requestId: string, message: string): Promise<{ error?: string }> {
  await requireUser(`/requests/${requestId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("ask_request_question", { p_request_id: requestId, p_message: message });
  if (error) return { error: error.message };
  return {};
}

/** Each person in an approved request accepts once. Their acceptance is their access to the private files. */
export async function acceptAgreement(requestId: string): Promise<{ error?: string; unlocked?: boolean }> {
  await requireUser(`/requests/${requestId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_agreement", { p_request_id: requestId });
  if (error) return { error: error.message };
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/dasbor");
  return { unlocked: true };
}

export async function withdrawRequest(requestId: string): Promise<{ error?: string }> {
  await requireUser(`/requests/${requestId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_request", { p_request_id: requestId });
  if (error) return { error: error.message };
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/dasbor");
  return {};
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  const user = await requireUser("/dasbor");
  const supabase = await createClient();
  if (ids.length === 0) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  } else {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
  }
  revalidatePath("/dasbor");
}
