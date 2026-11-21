"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, fieldErrorsFrom, formValues, type FormState } from "@/lib/validation";
import { dbErrorMessage } from "@/lib/errors";
import type { TFn } from "@/lib/labels";

async function tr() {
  const [v, a, e] = await Promise.all([getTranslations("validation"), getTranslations("actions"), getTranslations("errors")]);
  return { v: v as unknown as TFn, a: a as unknown as TFn, e: e as unknown as TFn };
}

function requestSchema(v: TFn) {
  return z.object({
    project_id: z.string().uuid(),
    slug: z.string().min(1),
    team_name: z.string().trim().min(2, v("teamNameMin")).max(60, v("teamNameMax")),
    teammates: z.string().trim().min(1, v("teammatesMin")),
    task_ids: z.array(z.string().uuid()).min(1, v("tasksMin")),
    plan: z.string().trim().min(40, v("planMin")).max(1500, v("planMax")),
    purpose: z.enum(["competition", "research", "course", "other"], { message: v("purpose") }),
    target_date: z
      .string()
      .min(1, v("targetDateRequired"))
      .refine((d) => !Number.isNaN(Date.parse(d)) && new Date(d) > new Date(), v("targetDateFuture")),
    fit_note: z.string().trim().max(600, v("fitNoteMax")).optional(),
    acknowledge: z.literal("on", { message: v("acknowledge") }),
  });
}

export async function submitRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await tr();
  const locale = await getLocale();
  const values = formValues(formData);
  const slug = values.slug ?? "";
  const user = await requireUser(`/projects/${slug}/request`);
  const task_ids = formData.getAll("task_ids").map(String);
  const parsed = requestSchema(t.v).safeParse({ ...values, task_ids });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error), values, data: { task_ids }, error: t.v("fixAndSend") };
  }

  const emails = parsed.data.teammates
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const checked = emails.map((e) => emailSchema(t.v).safeParse(e));
  if (checked.some((c) => !c.success)) {
    return { fieldErrors: { teammates: t.v("teammatesInvalid") }, values, data: { task_ids } };
  }
  const unique = [...new Set(emails)].filter((e) => e !== user.email.toLowerCase());
  if (unique.length < 2 || unique.length > 3) {
    return { fieldErrors: { teammates: t.v("teamSize") }, values, data: { task_ids } };
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
  if (error || !data) return { error: error ? dbErrorMessage(t.e, error) : t.a("requestFailed"), values, data: { task_ids } };
  revalidatePath("/dasbor");
  redirect({ href: `/requests/${data}`, locale });
}

export async function decideRequest(requestId: string, decision: "approved" | "declined", note: string): Promise<{ error?: string }> {
  const t = await tr();
  await requireUser(`/requests/${requestId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_request", { p_request_id: requestId, p_decision: decision, p_note: note });
  if (error) return { error: dbErrorMessage(t.e, error) };
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/dasbor");
  return {};
}

export async function askQuestion(requestId: string, message: string): Promise<{ error?: string }> {
  const t = await tr();
  await requireUser(`/requests/${requestId}`);
  if (!message.trim()) return { error: t.a("questionFirst") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("ask_request_question", { p_request_id: requestId, p_message: message });
  if (error) return { error: dbErrorMessage(t.e, error) };
  return {};
}

/** Each person in an approved request accepts once. Their acceptance is their access to the private files. */
export async function acceptAgreement(requestId: string): Promise<{ error?: string; unlocked?: boolean }> {
  const t = await tr();
  await requireUser(`/requests/${requestId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_agreement", { p_request_id: requestId });
  if (error) return { error: dbErrorMessage(t.e, error) };
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/dasbor");
  return { unlocked: true };
}

export async function withdrawRequest(requestId: string): Promise<{ error?: string }> {
  const t = await tr();
  await requireUser(`/requests/${requestId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_request", { p_request_id: requestId });
  if (error) return { error: dbErrorMessage(t.e, error) };
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
