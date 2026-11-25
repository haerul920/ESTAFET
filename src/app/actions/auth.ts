"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { sessionCookieOptions } from "@/lib/supabase/keys";
import { emailSchema, fieldErrorsFrom, formValues, safeNext, type FormState } from "@/lib/validation";
import { getSettings, isEmailAllowedBy } from "@/lib/settings";
import { isSuspendedProfile } from "@/lib/auth";
import { botSignalsFrom, verifyBot } from "@/lib/botcheck";
import { allow, clientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TFn } from "@/lib/labels";

async function tr() {
  const [v, a] = await Promise.all([getTranslations("validation"), getTranslations("actions")]);
  return { v: v as unknown as TFn, a: a as unknown as TFn };
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await tr();
  const locale = await getLocale();
  const values = formValues(formData);
  const parsed = z
    .object({ email: emailSchema(t.v), password: z.string().min(1, t.v("passwordRequired")) })
    .safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  // Slow down password guessing: per client address, and per email address (many addresses against one account).
  const ip = await clientIp();
  if (
    !(await allow({ scope: "login-ip", identity: ip, max: 20, windowSeconds: 900 })) ||
    !(await allow({ scope: "login-email", identity: parsed.data.email, max: 8, windowSeconds: 900 }))
  )
    return { error: t.a("tooManyAttempts"), values };

  const supabase = await createClient();
  const settings = await getSettings();
  const contact = settings.contact_email.value;
  const suspendedMessage = contact ? t.a("suspendedWithContact", { email: contact }) : t.a("suspendedNoContact");
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/banned/i.test(error.message)) return { error: suspendedMessage, values };
    return { error: t.a("loginFailed"), values };
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
  revalidatePath("/", "layout");
  redirect({ href: safeNext(values.next), locale });
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await tr();
  const locale = await getLocale();
  const values = formValues(formData);
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, t.v("fullName")),
      email: emailSchema(t.v),
      faculty: z.string().trim().optional(),
      password: z.string().min(8, t.v("passwordMin")),
      confirm_password: z.string().min(1, t.v("passwordConfirmRequired")),
      accept_policies: z.literal("on", { message: t.v("acceptPolicies") }),
    })
    .refine((d) => d.password === d.confirm_password, {
      path: ["confirm_password"],
      message: t.v("passwordMismatch"),
    })
    .safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  // Bot check first (Turnstile when configured, the local check otherwise), then a limit per client address.
  const ip = await clientIp();
  if (!(await verifyBot(botSignalsFrom(formData), ip))) return { error: t.a("botFailed"), values };
  if (!(await allow({ scope: "signup-ip", identity: ip, max: 5, windowSeconds: 3600 })))
    return { error: t.a("signupLimited"), values };

  const settings = await getSettings();
  if (!settings.registrations_open.value) return { error: t.a("registrationsClosed"), values };
  if (!isEmailAllowedBy(parsed.data.email, settings.allowed_email_domains.value)) {
    return {
      fieldErrors: { email: t.v("domainNotAllowed", { domains: settings.allowed_email_domains.value.join(", ") }) },
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
    return { error: taken ? t.a("emailTaken") : t.a("signupFailed"), values };
  }
  // Record which version of each policy was accepted. The user has no session yet when email confirmation is on,
  // so the server writes it with the service role for the account that was just created.
  if (data.user && data.user.identities && data.user.identities.length > 0) {
    const admin = createAdminClient();
    const { data: versions } = await admin
      .from("policies")
      .select("kind, version, effective_at")
      .lte("effective_at", new Date().toISOString());
    const latest = new Map<string, number>();
    for (const v of (versions ?? []) as { kind: string; version: number }[])
      latest.set(v.kind, Math.max(latest.get(v.kind) ?? 0, v.version));
    const rows = [...latest.entries()].map(([kind, version]) => ({ profile_id: data.user!.id, kind, version }));
    if (rows.length)
      await admin
        .from("policy_acceptances")
        .upsert(rows, { onConflict: "profile_id,kind,version", ignoreDuplicates: true });
  }
  if (!data.session) return { ok: true, message: t.a("signupDone") };
  revalidatePath("/", "layout");
  redirect({ href: safeNext(values.next), locale });
}

/** Sends the confirmation link again to the signed-in user's email address. */
export async function resendVerification(): Promise<{ error?: string }> {
  const t = await tr();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: (await getTranslations("errors"))("signIn") };
  if (user.email_confirmed_at) return {};
  if (!(await allow({ scope: "resend-verification", identity: user.id, max: 3, windowSeconds: 3600 })))
    return { error: t.a("resendWait") };
  const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
  if (error) return { error: /rate|seconds|frequen/i.test(error.message) ? t.a("resendWait") : t.a("resendFail") };
  return {};
}

export async function signOut() {
  const locale = await getLocale();
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    /* ignore remote sign-out errors so local session cookies are still wiped */
  }
  const cookieStore = await cookies();
  const opts = sessionCookieOptions();
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith("sb-")) {
      try {
        cookieStore.set(c.name, "", { ...opts, maxAge: 0, expires: new Date(0) });
        cookieStore.delete(c.name);
      } catch {
        /* ignore cookie deletion errors */
      }
    }
  }
  revalidatePath("/", "layout");
  redirect({ href: "/", locale });
}
