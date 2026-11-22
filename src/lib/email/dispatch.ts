import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { alert, errorFields, log } from "@/lib/log";
import { renderEmail, type EmailLocale } from "./templates";
import { EmailError, providerName, sendEmail } from "./provider";

interface OutboxRow {
  id: string;
  user_id: string;
  template: string;
  locale: string;
  payload: Record<string, unknown>;
  essential: boolean;
  attempts: number;
}

export interface DispatchResult {
  queued: number;
  sent: number;
  retry: number;
  failed: number;
}

/**
 * One pass of the email sender, run by the scheduled job:
 *   1. turn new notifications into outbox rows (the database decides who gets what, honouring preferences),
 *   2. claim the rows that are due,
 *   3. send each one and record the result. A failure is retried later by the database schedule (see `finish_email`).
 * Logs carry ids, templates and counts only, never addresses or text.
 */
export async function dispatchEmails(limit = 25): Promise<DispatchResult> {
  const db = createAdminClient();
  const result: DispatchResult = { queued: 0, sent: 0, retry: 0, failed: 0 };

  const queued = await db.rpc("enqueue_emails");
  if (queued.error) log.error("email.enqueue_failed", errorFields(queued.error));
  else result.queued = Number(queued.data) || 0;

  const claimed = await db.rpc("claim_emails", { p_limit: limit });
  if (claimed.error) {
    log.error("email.claim_failed", errorFields(claimed.error));
    return result;
  }
  const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");

  for (const row of (claimed.data ?? []) as OutboxRow[]) {
    const outcome = await deliver(db, row, appUrl);
    const { data: state } = await db.rpc("finish_email", {
      p_id: row.id,
      p_ok: outcome.ok,
      p_error: outcome.ok ? null : outcome.code,
    });
    if (outcome.ok) result.sent++;
    else if (state === "failed") {
      result.failed++;
      log.error("email.failed", { template: row.template, attempts: row.attempts, code: outcome.code });
    } else {
      result.retry++;
      log.warn("email.retry", { template: row.template, attempts: row.attempts, code: outcome.code });
    }
  }

  if (result.failed > 0)
    await alert("email_failed", `${result.failed} email(s) could not be delivered after all attempts.`, {
      count: result.failed,
    });
  if (result.sent + result.retry + result.failed + result.queued > 0)
    log.info("email.dispatch", { ...result, provider: providerName() });
  return result;
}

async function deliver(
  db: ReturnType<typeof createAdminClient>,
  row: OutboxRow,
  appUrl: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  try {
    // The address is read now, not stored in the outbox, so a changed or deleted address is respected.
    const [{ data: auth }, { data: profile }] = await Promise.all([
      db.auth.admin.getUserById(row.user_id),
      db.from("profiles").select("full_name").eq("id", row.user_id).maybeSingle(),
    ]);
    const to = auth?.user?.email;
    if (!to) return { ok: false, code: "no_address" };
    const locale: EmailLocale = row.locale === "en" ? "en" : "id";
    const mail = renderEmail(row.template, locale, row.payload, {
      appUrl,
      name: profile?.full_name,
      essential: row.essential,
    });
    if (!mail) return { ok: false, code: "unknown_template" };
    await sendEmail({
      to,
      ...mail,
      unsubscribeUrl: row.essential ? undefined : `${appUrl}${locale === "en" ? "/en" : ""}/akun/privasi`,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e instanceof EmailError ? e.code : "error" };
  }
}
