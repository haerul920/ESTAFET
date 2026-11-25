"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/errors";
import { safeNext } from "@/lib/validation";
import type { TFn } from "@/lib/labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { AVATAR_BUCKET, AVATAR_MAX_BYTES, isJpeg, ownAvatarPath } from "@/lib/account/avatar";
import { allow } from "@/lib/rate-limit";
import { log } from "@/lib/log";

/** Starts the 30 day grace period for deleting the signed-in account. Nothing is deleted yet. */
export async function requestAccountDeletion(): Promise<{ error?: string }> {
  const [errors, t] = (await Promise.all([
    getTranslations("errors"),
    getTranslations("account.delete"),
  ])) as unknown as [TFn, TFn];
  await requireUser("/akun/setelan");
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_account_deletion");
  if (error) return { error: dbErrorMessage(errors, error) || t("failed") };
  revalidatePath("/akun/setelan");
  revalidatePath("/dasbor");
  return {};
}

/** Cancels a scheduled deletion (possible until the date). */
export async function cancelAccountDeletion(): Promise<{ error?: string }> {
  const errors = (await getTranslations("errors")) as unknown as TFn;
  await requireUser("/akun/setelan");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_account_deletion");
  if (error) return { error: dbErrorMessage(errors, error) };
  revalidatePath("/akun/setelan");
  revalidatePath("/dasbor");
  return {};
}

/** Saves the person's own choice: notification emails on or off, and the language of the emails. */
export async function saveEmailPreferences(formData: FormData): Promise<{ error?: string }> {
  const t = await getTranslations("account.email");
  await requireUser("/akun/setelan");
  const locale = String(formData.get("locale") ?? "id") === "en" ? "en" : "id";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_email_preferences", {
    p_enabled: formData.get("enabled") === "on",
    p_locale: locale,
  });
  if (error) return { error: t("failed") };
  revalidatePath("/akun/setelan");
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

/** The person's own display name. */
export async function saveProfileName(name: string): Promise<{ error?: string; fieldError?: string }> {
  const [tp, tv] = await Promise.all([getTranslations("account.profile"), getTranslations("validation")]);
  const user = await requireUser("/akun/setelan");
  const parsed = z
    .string()
    .trim()
    .min(2, tv("fullName"))
    .max(80, tp("nameTooLong"))
    .safeParse(String(name).replace(/\s+/g, " "));
  if (!parsed.success) return { fieldError: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data }).eq("id", user.id);
  if (error) return { error: tp("failed") };
  revalidatePath("/", "layout");
  return {};
}

/** Removes a stored photo. A failure is logged and does not stop the person's change. */
async function dropAvatar(userId: string, stored: string | null | undefined) {
  const old = ownAvatarPath(userId, stored);
  if (!old) return;
  const { error } = await createAdminClient().storage.from(AVATAR_BUCKET).remove([old]);
  if (error) log.warn("avatar_remove_failed", { profileId: userId });
}

/** Saves a new profile photo. The browser already shrank it; the server still checks its size and its real type. */
export async function saveAvatar(formData: FormData): Promise<{ error?: string }> {
  const tp = await getTranslations("account.profile");
  const user = await requireUser("/akun/setelan");
  const file = formData.get("photo");
  if (!(file instanceof Blob) || file.size === 0 || file.size > AVATAR_MAX_BYTES)
    return { error: tp("photoUnreadable") };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isJpeg(bytes)) return { error: tp("photoUnreadable") };
  if (!(await allow({ scope: "avatar", identity: user.id, max: 20, windowSeconds: 3600 })))
    return { error: tp("photoTooOften") };

  const admin = createAdminClient();
  const path = `${user.id}/${randomUUID()}.jpg`;
  const stored = await admin.storage.from(AVATAR_BUCKET).upload(path, bytes, { contentType: "image/jpeg" });
  if (stored.error) return { error: tp("failed") };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
  if (error) {
    await dropAvatar(user.id, path);
    return { error: tp("failed") };
  }
  await dropAvatar(user.id, user.profile?.avatar_url);
  revalidatePath("/", "layout");
  return {};
}

export async function removeAvatar(): Promise<{ error?: string }> {
  const tp = await getTranslations("account.profile");
  const user = await requireUser("/akun/setelan");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return { error: tp("failed") };
  await dropAvatar(user.id, user.profile?.avatar_url);
  revalidatePath("/", "layout");
  return {};
}
