"use server";

import { after } from "next/server";
import { cookies } from "next/headers";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, fieldErrorsFrom, formValues, safeNext, type FormState } from "@/lib/validation";
import { getSettings, isEmailAllowedBy } from "@/lib/settings";
import { isSuspendedProfile } from "@/lib/auth";
import { botSignalsFrom, verifyBot } from "@/lib/botcheck";
import { allow, clientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/supabase/keys";
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
  // Admins work in /admin (user pages send them there anyway); everyone else lands on the dashboard by default.
  const next = safeNext(values.next);
  const { data: admin } = await supabase.rpc("is_admin");
  const target = admin === true && next === "/dasbor" ? "/admin" : next;
  // A newer Terms or Privacy Policy: go straight to the re-acceptance screen. Redirecting to `next` and letting that
  // page redirect again happens inside this action's response, so the address bar keeps the old URL, and the form
  // on the re-acceptance screen then posts to the wrong route ("Server Action not found").
  if (!target.startsWith("/admin")) {
    const { data: accepted, error: policyError } = await supabase.rpc("i_accepted_current_policies");
    if (!policyError && accepted === false) {
      redirect({ href: `/kebijakan/setujui?next=${encodeURIComponent(target)}`, locale });
    }
  }
  redirect({ href: target, locale });
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
      accept_policies: z.literal("on", { message: t.v("acceptPolicies") }),
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

/** Supabase session cookies, also when split into chunks (`.0`, `.1`, ...). */
const SESSION_COOKIE = /^sb-.+-auth-token(?:-code-verifier)?(?:.d+)?$/;

/**
 * Signs out without making the person wait for Supabase: the session cookies are removed at once and the redirect
 * leaves immediately. Revoking the session at Supabase (one network round trip) runs after the response is sent.
 */
export async function signOut() {
  const locale = await getLocale();
  const supabase = await createClient();
  // Read from the cookie only (no network call), before the cookie goes.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const store = await cookies();
  for (const c of store.getAll()) {
    if (SESSION_COOKIE.test(c.name)) store.set(c.name, "", { path: "/", maxAge: 0 });
  }
  if (token) {
    after(async () => {
      const plain = createPlainClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, { auth: { persistSession: false } });
      await plain.auth.admin.signOut(token, "local").catch(() => undefined);
    });
  }
  redirect({ href: "/", locale });
}
