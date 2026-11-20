"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, fieldErrorsFrom, formValues, safeNext, type FormState } from "@/lib/validation";
import { getSettings, isEmailAllowedBy } from "@/lib/settings";
import { isSuspendedProfile } from "@/lib/auth";

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name."),
  email: emailSchema,
  faculty: z.string().trim().optional(),
  password: z.string().min(8, "Use at least 8 characters."),
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
  if (!data.session) {
    return { ok: true, message: "Account created. Check your email to confirm it, then sign in." };
  }
  redirect(safeNext(values.next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
