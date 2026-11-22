"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/errors";
import { safeNext } from "@/lib/validation";
import type { TFn } from "@/lib/labels";

/** Starts the 30 day grace period for deleting the signed-in account. Nothing is deleted yet. */
export async function requestAccountDeletion(): Promise<{ error?: string }> {
  const [errors, t] = (await Promise.all([
    getTranslations("errors"),
    getTranslations("account.delete"),
  ])) as unknown as [TFn, TFn];
  await requireUser("/akun/privasi");
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_account_deletion");
  if (error) return { error: dbErrorMessage(errors, error) || t("failed") };
  revalidatePath("/akun/privasi");
  revalidatePath("/dasbor");
  return {};
}

/** Cancels a scheduled deletion (possible until the date). */
export async function cancelAccountDeletion(): Promise<{ error?: string }> {
  const errors = (await getTranslations("errors")) as unknown as TFn;
  await requireUser("/akun/privasi");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_account_deletion");
  if (error) return { error: dbErrorMessage(errors, error) };
  revalidatePath("/akun/privasi");
  revalidatePath("/dasbor");
  return {};
}

/** Saves the person's own choice: notification emails on or off, and the language of the emails. */
export async function saveEmailPreferences(formData: FormData): Promise<{ error?: string }> {
  const t = await getTranslations("account.email");
  await requireUser("/akun/privasi");
  const locale = String(formData.get("locale") ?? "id") === "en" ? "en" : "id";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_email_preferences", {
    p_enabled: formData.get("enabled") === "on",
    p_locale: locale,
  });
  if (error) return { error: t("failed") };
  revalidatePath("/akun/privasi");
  return {};
}

/** The re-acceptance screen: records the current Terms and Privacy Policy, then goes on to where the person was headed. */
export async function acceptPoliciesAndContinue(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const next = safeNext(String(formData.get("next") ?? ""));
  await requireUser(`/kebijakan/setujui?next=${encodeURIComponent(next)}`, { skipPolicyCheck: true });
  if (formData.get("accept") !== "on")
    redirect({ href: `/kebijakan/setujui?next=${encodeURIComponent(next)}`, locale });
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_current_policies");
  if (error) redirect({ href: `/kebijakan/setujui?next=${encodeURIComponent(next)}`, locale });
  redirect({ href: next, locale });
}
