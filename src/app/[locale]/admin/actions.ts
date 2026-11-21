"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ReauthRequired, requireAdmin, requireRecentAuth } from "@/lib/admin/guard";
import { REAUTH_COOKIE, REAUTH_MINUTES, signReauth } from "@/lib/admin/reauth";
import { isProduction } from "@/lib/admin/env";
import { setAuthBan } from "@/lib/admin/ban";
import { removeDemoObjects } from "@/lib/admin/purge";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/supabase/keys";
import { runSynthesis } from "@/lib/synthesis";
import { trialSchema } from "@/lib/admin/trial-schema";
import { SETTING_KEYS, SETTING_SCHEMAS, type SettingKey } from "@/lib/settings";

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
    if (e instanceof ReauthRequired) return { needsReauth: true, error: e.message };
    throw e; // notFound() and redirects must pass through
  }
}

const fail = (error: { message: string } | null): ActionResult | undefined =>
  error ? { error: error.message } : undefined;

/** Password check for sensitive actions. Remembered for 15 minutes in a signed httpOnly cookie. */
export async function reauthenticate(password: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!password) return { error: "Enter your password." };
  const plain = createPlainClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await plain.auth.signInWithPassword({ email: user.email, password });
  if (error) return { error: "That password is not correct." };
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

export async function suspendUser(userId: string, reason: string, until: string | null): Promise<ActionResult> {
  return run(true, async (db) => {
    const untilDate = until ? new Date(until) : null;
    if (untilDate && Number.isNaN(untilDate.getTime())) return { error: "Enter a valid end date." };
    const { error } = await db.rpc("admin_suspend_user", {
      p_user: userId,
      p_reason: reason,
      p_until: untilDate ? untilDate.toISOString() : null,
    });
    if (error) return { error: error.message };
    const banError = await setAuthBan(userId, untilDate);
    if (banError) return { error: `The suspension was recorded, but sign-in could not be blocked: ${banError}` };
  });
}

export async function restoreUser(userId: string, reason: string): Promise<ActionResult> {
  return run(false, async (db) => {
    const { error } = await db.rpc("admin_restore_user", { p_user: userId, p_reason: reason });
    if (error) return { error: error.message };
    const banError = await setAuthBan(userId, "lift");
    if (banError) return { error: `The account is restored, but the sign-in block could not be lifted: ${banError}` };
  });
}

export async function openBreakGlass(projectId: string, fileId: string, reason: string): Promise<ActionResult> {
  return run(true, async (db) => {
    const { data, error } = await db.rpc("admin_break_glass", {
      p_project: projectId,
      p_file: fileId,
      p_reason: reason,
    });
    if (error) return { error: error.message };
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

export async function cancelRun(runId: string, reason: string): Promise<ActionResult> {
  return run(false, async (db) => fail((await db.rpc("admin_cancel_run", { p_run: runId, p_reason: reason })).error));
}

/** Writes the audit row first, then re-runs the synthesis. The run counts toward the original user's daily cap. */
export async function retryRun(runId: string, reason: string): Promise<ActionResult> {
  return run(false, async (db) => {
    const { data: row } = await db
      .from("admin_runs_v")
      .select("id, project_id, status, requested_by")
      .eq("id", runId)
      .maybeSingle();
    if (!row) return { error: "Run not found." };
    if (row.status !== "failed") return { error: "Only a failed run can be retried." };
    const logged = await db.rpc("admin_log_action", {
      p_action: "run.retry",
      p_target_type: "synthesis_run",
      p_target_id: runId,
      p_reason: reason,
      p_before: { status: "failed" },
      p_after: { project_id: row.project_id },
    });
    if (logged.error) return { error: logged.error.message };
    const result = await runSynthesis(row.project_id, row.requested_by);
    if (!result.ok) return { error: `The retry failed: ${result.error}` };
    return { data: { items: result.items } };
  });
}

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
};

export async function updateSetting(key: string, raw: string | boolean, reason: string): Promise<ActionResult> {
  if (!(SETTING_KEYS as readonly string[]).includes(key)) return { error: "Unknown setting." };
  const k = key as SettingKey;
  const parsed = (SETTING_SCHEMAS[k] as z.ZodType).safeParse(SETTING_INPUT[k](raw));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That value is not valid." };
  return run(true, async (db) =>
    fail((await db.rpc("admin_update_setting", { p_key: k, p_value: parsed.data, p_reason: reason })).error),
  );
}

export async function purgeDemoData(reason: string): Promise<ActionResult> {
  if (isProduction()) return { error: "Purging demo data is disabled in the PRODUCTION environment." };
  return run(true, async (db) => {
    const { data: paths, error: pathError } = await db.rpc("admin_demo_storage_paths");
    if (pathError) return { error: pathError.message };
    await removeDemoObjects((paths as string[] | null) ?? []);
    const { data, error } = await db.rpc("admin_purge_demo", { p_reason: reason, p_allow: !isProduction() });
    if (error) return { error: error.message };
    return { data: data as Record<string, unknown> };
  });
}

// ---- Trials -----------------------------------------------------------------------------------

export async function saveTrial(
  input: Record<string, unknown>,
): Promise<ActionResult & { fieldErrors?: Record<string, string> }> {
  await requireAdmin();
  const parsed = trialSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "_")] ??= i.message;
    return { error: "Fix the highlighted fields.", fieldErrors };
  }
  const { id, ...rest } = parsed.data;
  const res = await run(false, async (db) =>
    fail((await db.rpc("admin_trial_save", { p_id: id || null, p_data: rest })).error),
  );
  return res;
}
