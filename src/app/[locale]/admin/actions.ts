"use server";

import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ReauthRequired, requireAdmin, requireRecentAuth } from "@/lib/admin/guard";
import { REAUTH_COOKIE, REAUTH_MINUTES, signReauth } from "@/lib/admin/reauth";
import { setAuthBan } from "@/lib/admin/ban";
import { sendConfirmationAgain } from "@/lib/admin/auth-users";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/supabase/keys";
import { SETTING_KEYS, SETTING_SCHEMAS, type SettingKey } from "@/lib/settings";
import { KNOWN_HINTS } from "@/lib/errors";
import { hasFixedAnchors, LEGAL_DOCS, legalContentSchema } from "@/lib/legal/content";

/**
 * Every admin mutation goes through an `admin_*` SQL function that writes the change and the audit row
 * in one transaction. This file never writes tables directly (a test enforces that).
 */
export interface ActionResult {
  ok?: boolean;
  error?: string;
  needsReauth?: boolean;
  data?: Record<string, unknown>;
}

type Db = Awaited<ReturnType<typeof createClient>>;

async function run(
  sensitive: boolean,
  fn: (db: Db, userId: string) => Promise<ActionResult | void>,
): Promise<ActionResult> {
  try {
    const user = sensitive ? await requireRecentAuth() : await requireAdmin();
    const res = (await fn(await createClient(), user.id)) ?? { ok: true };
    revalidatePath("/admin", "layout");
    return res.error ? res : { ok: true, ...res };
  } catch (e) {
    if (e instanceof ReauthRequired) {
      return { needsReauth: true, error: (await getTranslations("admin.reason"))("needsReauth") };
    }
    throw e; // notFound() and redirects must pass through
  }
}

/** A message from the `admin.errors` namespace, in the admin's language. */
async function msg(key: string, values?: Record<string, string | number>): Promise<string> {
  const t = await getTranslations("admin.errors");
  return t(key as never, values as never);
}

async function hasMsg(key: string): Promise<boolean> {
  return (await getTranslations("admin.errors")).has(key as never);
}

/** The text for a database error: a known hint gets its message, anything else is shown with its original detail. */
async function dbMsg(error: { message?: string; hint?: string | null; code?: string }): Promise<string> {
  const hint = error.hint ?? "";
  if (hint && KNOWN_HINTS.has(hint)) return (await getTranslations("errors"))(`hints.${hint}` as never);
  if (error.code === "42501") return (await getTranslations("errors"))("forbidden");
  return msg("detail", { message: error.message ?? "" });
}

const fail = async (error: { message: string } | null): Promise<ActionResult | undefined> =>
  error ? { error: await dbMsg(error) } : undefined;

/** Password check for sensitive actions. Remembered for 15 minutes in a signed httpOnly cookie. */
export async function reauthenticate(password: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!password) return { error: await msg("enterPassword") };
  const plain = createPlainClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await plain.auth.signInWithPassword({ email: user.email, password });
  if (error) return { error: await msg("wrongPassword") };
  const store = await cookies();
  store.set(REAUTH_COOKIE, signReauth(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REAUTH_MINUTES * 60,
  });
  return { ok: true };
}

// ---- Moderation -------------------------------------------------------------------------------

export async function setProjectModeration(
  projectId: string,
  status: "ok" | "held" | "hidden" | "removed",
  reason: string,
): Promise<ActionResult> {
  return run(status === "removed", async (db) =>
    fail(
      (await db.rpc("admin_set_project_moderation", { p_project: projectId, p_status: status, p_reason: reason }))
        .error,
    ),
  );
}

export async function handleReport(
  reportId: string,
  action: "dismiss" | "in_review" | "hold" | "hide" | "remove",
  note: string,
): Promise<ActionResult> {
  return run(action === "remove", async (db) =>
    fail((await db.rpc("admin_handle_report", { p_report: reportId, p_action: action, p_note: note })).error),
  );
}

export async function resolveAppeal(
  appealId: string,
  outcome: "accepted" | "rejected",
  note: string,
): Promise<ActionResult> {
  return run(false, async (db) =>
    fail((await db.rpc("admin_resolve_appeal", { p_appeal: appealId, p_outcome: outcome, p_note: note })).error),
  );
}

export async function bulkDismissSpam(ids: string[], note: string): Promise<ActionResult> {
  return run(false, async (db) => {
    const { data, error } = await db.rpc("admin_bulk_dismiss_spam", { p_ids: ids, p_note: note });
    if (error) return { error: await dbMsg(error) };
    return { data: { dismissed: data as number } };
  });
}

// ---- Announcements and policies ---------------------------------------------------------------

export interface AnnouncementInput {
  id: string | null;
  severity: "info" | "warning" | "critical";
  textId: string;
  textEn: string;
  startsAt: string | null;
  endsAt: string | null;
  dismissible: boolean;
}

// Messages are codes (messages admin.errors.*).
const announcementSchema = z.object({
  severity: z.enum(["info", "warning", "critical"]),
  textId: z.string().trim().min(3, "textId").max(280, "textMax"),
  textEn: z.string().trim().min(3, "textEn").max(280, "textMax"),
});

function toIso(v: string | null): string | null | "invalid" {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "invalid" : d.toISOString();
}

export async function saveAnnouncement(input: AnnouncementInput, reason: string): Promise<ActionResult> {
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { error: await msg(parsed.error.issues[0]?.message ?? "checkAnnouncement") };
  const starts = toIso(input.startsAt);
  const ends = toIso(input.endsAt);
  if (starts === "invalid" || ends === "invalid") return { error: await msg("validDates") };
  return run(false, async (db) =>
    fail(
      (
        await db.rpc("admin_save_announcement", {
          p_id: input.id,
          p_severity: parsed.data.severity,
          p_text_id: parsed.data.textId,
          p_text_en: parsed.data.textEn,
          p_starts: starts,
          p_ends: ends,
          p_dismissible: input.dismissible,
          p_reason: reason,
        })
      ).error,
    ),
  );
}

export async function endAnnouncement(id: string, reason: string): Promise<ActionResult> {
  return run(false, async (db) => fail((await db.rpc("admin_end_announcement", { p_id: id, p_reason: reason })).error));
}

/** A new policy version makes everyone accept it again. It is a platform-wide change, so it needs a recent password check. */
/** Publishes a document written in the editor. For the Terms and the Privacy Policy this is also a new version. */
export async function publishLegalDocument(doc: string, content: unknown, reason: string): Promise<ActionResult> {
  const name = z.enum(LEGAL_DOCS).safeParse(doc);
  const parsed = legalContentSchema.safeParse(content);
  if (!name.success || !parsed.success || !hasFixedAnchors(name.data, parsed.data))
    return { error: await msg("documentInvalid") };
  return run(true, async (db) =>
    fail(
      (await db.rpc("admin_publish_document", { p_doc: name.data, p_content: parsed.data, p_reason: reason })).error,
    ),
  );
}

// ---- Users: sessions and verification ---------------------------------------------------------

export async function forceSignOut(userId: string, reason: string): Promise<ActionResult> {
  return run(false, async (db) => {
    const { data, error } = await db.rpc("admin_force_sign_out", { p_user: userId, p_reason: reason });
    if (error) return { error: await dbMsg(error) };
    return { data: { sessionsEnded: data as number } };
  });
}

/** Sends the confirmation email again for an account that never confirmed it. Logged in the audit log. */
export async function resendUserVerification(userId: string, reason: string): Promise<ActionResult> {
  return run(false, async (db) => {
    const problem = await sendConfirmationAgain(userId);
    if (problem) return { error: await msg(problem) };
    return fail(
      (
        await db.rpc("admin_log_action", {
          p_action: "user.resend_verification",
          p_target_type: "user",
          p_target_id: userId,
          p_reason: reason,
          p_before: null,
          p_after: null,
        })
      ).error,
    );
  });
}

export async function suspendUser(userId: string, reason: string, until: string | null): Promise<ActionResult> {
  return run(true, async (db) => {
    const untilDate = until ? new Date(until) : null;
    if (untilDate && Number.isNaN(untilDate.getTime())) return { error: await msg("validEndDate") };
    const { error } = await db.rpc("admin_suspend_user", {
      p_user: userId,
      p_reason: reason,
      p_until: untilDate ? untilDate.toISOString() : null,
    });
    if (error) return { error: await dbMsg(error) };
    const banError = await setAuthBan(userId, untilDate);
    if (banError) return { error: await msg("suspendBan", { detail: banError }) };
  });
}

export async function restoreUser(userId: string, reason: string): Promise<ActionResult> {
  return run(false, async (db) => {
    const { error } = await db.rpc("admin_restore_user", { p_user: userId, p_reason: reason });
    if (error) return { error: await dbMsg(error) };
    const banError = await setAuthBan(userId, "lift");
    if (banError) return { error: await msg("restoreBan", { detail: banError }) };
  });
}

/** Gives or takes the admin role. Needs a recent password check; the SQL function writes the audit row. */
export async function setUserRole(userId: string, makeAdmin: boolean, reason: string): Promise<ActionResult> {
  return run(true, async (db) => {
    const { error } = await db.rpc("admin_set_role", { p_user: userId, p_admin: makeAdmin, p_reason: reason });
    if (error) return { error: await dbMsg(error) };
  });
}

export async function openBreakGlass(projectId: string, fileId: string, reason: string): Promise<ActionResult> {
  return run(true, async (db) => {
    const { data, error } = await db.rpc("admin_break_glass", {
      p_project: projectId,
      p_file: fileId,
      p_reason: reason,
    });
    if (error) return { error: await dbMsg(error) };
    return { data: { accessId: (data as { access_id: string }).access_id } };
  });
}

export async function addNote(
  targetType: "request" | "project" | "user",
  targetId: string,
  note: string,
): Promise<ActionResult> {
  return run(false, async (db) =>
    fail((await db.rpc("admin_add_note", { p_target_type: targetType, p_target_id: targetId, p_note: note })).error),
  );
}

// ---- Operations -------------------------------------------------------------------------------

const SETTING_INPUT: Record<SettingKey, (raw: string | boolean) => unknown> = {
  allowed_email_domains: (r) =>
    String(r)
      .split(/[\s,;]+/)
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  max_upload_mb: (r) => Number(r),
  synthesis_daily_cap: (r) => Number(r),
  show_demo_banner: (r) => r === true || r === "true",
  registrations_open: (r) => r === true || r === "true",
  contact_email: (r) => String(r).trim(),
  request_expiry_days: (r) => Number(r),
  reapply_cooldown_days: (r) => Number(r),
  report_hold_threshold: (r) => Number(r),
  hold_review_days: (r) => Number(r),
};

export async function updateSetting(key: string, raw: string | boolean, reason: string): Promise<ActionResult> {
  if (!(SETTING_KEYS as readonly string[]).includes(key)) return { error: await msg("unknownSetting") };
  const k = key as SettingKey;
  const parsed = (SETTING_SCHEMAS[k] as z.ZodType).safeParse(SETTING_INPUT[k](raw));
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message ?? "";
    return { error: await msg((await hasMsg(`setting_${code}`)) ? `setting_${code}` : "invalidValue") };
  }
  return run(true, async (db) =>
    fail((await db.rpc("admin_update_setting", { p_key: k, p_value: parsed.data, p_reason: reason })).error),
  );
}
