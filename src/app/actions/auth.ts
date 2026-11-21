"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, fieldErrorsFrom, formValues, safeNext, type FormState } from "@/lib/validation";
import { getSettings, isEmailAllowedBy } from "@/lib/settings";
import { isSuspendedProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name."),
  email: emailSchema,
  faculty: z.string().trim().optional(),
  password: z.string().min(8, "Use at least 8 characters."),
  accept_policies: z.literal("on", { message: "Accept the Terms and the Privacy Policy to create an account." }),
});

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const settings = await getSettings();
  const contact = settings.contact_email.value;
  const suspendedMessage = `Your account is suspended. ${contact ? `Write to ${contact} to ask about it.` : "Contact the ESTAFET team to ask about it."}`;
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/banned/i.test(error.message)) return { error: suspendedMessage, values };
    return { error: "That email and password do not match. Check both and try again.", values };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("suspended_at, suspended_until")
    .eq("id", data.user.id)
    .maybeSingle();
  if (isSuspendedProfile(profile)) {
    await supabase.auth.signOut();
    return { error: suspendedMessage, values };
  }
  redirect(safeNext(values.next));
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = signupSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const settings = await getSettings();
  if (!settings.registrations_open.value) {
    return { error: "New registrations are closed right now. Please try again later.", values };
  }
  if (!isEmailAllowedBy(parsed.data.email, settings.allowed_email_domains.value)) {
    return {
      fieldErrors: { email: `Use your university email (${settings.allowed_email_domains.value.join(", ")}).` },
      values,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name, faculty: parsed.data.faculty ?? null } },
  });
  if (error) {
    const taken = /registered|already/i.test(error.message);
    return {
      error: taken ? "An account with this email already exists. Try signing in." : error.message,
      values,
    };
  }
  // Record which version of each policy was accepted. The user has no session yet when email confirmation is on,
  // so the server writes it with the service role for the account that was just created.
  if (data.user && data.user.identities && data.user.identities.length > 0) {
    const admin = createAdminClient();
    const { data: versions } = await admin.from("policies").select("kind, version, effective_at").lte("effective_at", new Date().toISOString());
    const latest = new Map<string, number>();
    for (const v of (versions ?? []) as { kind: string; version: number }[]) latest.set(v.kind, Math.max(latest.get(v.kind) ?? 0, v.version));
    const rows = [...latest.entries()].map(([kind, version]) => ({ profile_id: data.user!.id, kind, version }));
    if (rows.length) await admin.from("policy_acceptances").upsert(rows, { onConflict: "profile_id,kind,version", ignoreDuplicates: true });
  }
  if (!data.session) {
    return { ok: true, message: "Account created. Check your email to confirm it, then sign in." };
  }
  redirect(safeNext(values.next));
}

/** Sends the confirmation link again to the signed-in user's email address. */
export async function resendVerification(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Sign in first." };
  if (user.email_confirmed_at) return {};
  const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
  if (error) return { error: /rate|seconds|frequen/i.test(error.message) ? "Wait a minute before asking for another link." : "We could not send the link. Please try again later." };
  return {};
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
