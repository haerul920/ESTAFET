import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDueDeletions, type DeletionClient } from "@/lib/account/deletion";
import { dispatchEmails } from "@/lib/email/dispatch";
import { alert, errorFields, log } from "@/lib/log";

/**
 * Scheduled jobs (CLAUDE.md 14.10). The scheduler calls these with `Authorization: Bearer <CRON_SECRET>`:
 *   /api/cron/emails   every 10 minutes: queue and send emails
 *   /api/cron/daily    once a day: expire requests, remind about expiring ones, escalate overdue holds,
 *                      finish account deletions after the grace period, clean up old rows
 * Vercel Cron sends the header by itself when the CRON_SECRET variable exists. Any other scheduler (Supabase pg_cron,
 * GitHub Actions, a plain cron job) can use curl. The jobs are safe to run twice: every one of them is idempotent.
 * See docs/runbook.md.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const sent = request.headers.get("authorization") ?? "";
  // Compare hashes of equal length, in constant time.
  const a = createHash("sha256").update(sent).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

interface Step {
  name: string;
  ok: boolean;
  count?: number;
}

async function step(name: string, fn: () => Promise<number>): Promise<Step> {
  try {
    return { name, ok: true, count: await fn() };
  } catch (e) {
    log.error("cron.step_failed", { step: name, ...errorFields(e) });
    return { name, ok: false };
  }
}

async function daily(): Promise<Step[]> {
  const db = createAdminClient();
  const rpc = (fn: string, args?: Record<string, unknown>) => async () => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw error;
    return typeof data === "number" ? data : 0;
  };
  return [
    await step("expire_requests", rpc("expire_requests")),
    await step("remind_expiring_requests", rpc("remind_expiring_requests", { p_days: 3 })),
    await step("escalate_overdue_holds", rpc("escalate_overdue_holds")),
    await step("housekeeping", async () => {
      const { error } = await db.rpc("housekeeping");
      if (error) throw error;
      return 0;
    }),
    await step("account_deletions", async () => {
      const results = await processDueDeletions(db as unknown as DeletionClient);
      const failed = results.filter((r) => !r.ok);
      if (failed.length) throw new Error(`${failed.length} deletion(s) need a manual finish`);
      return results.length;
    }),
  ];
}

async function handle(request: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  if (!authorized(request)) return new NextResponse(null, { status: 401 });
  const { job } = await params;
  const started = Date.now();

  let steps: Step[];
  if (job === "emails") {
    try {
      const r = await dispatchEmails();
      steps = [{ name: "emails", ok: true, count: r.sent }];
    } catch (e) {
      log.error("cron.step_failed", { step: "emails", ...errorFields(e) });
      steps = [{ name: "emails", ok: false }];
    }
  } else if (job === "daily") {
    steps = await daily();
  } else {
    return new NextResponse(null, { status: 404 });
  }

  const failed = steps.filter((s) => !s.ok);
  log.info("cron.done", { job, ms: Date.now() - started, failed: failed.length });
  if (failed.length)
    await alert("cron_failed", `Scheduled job "${job}" had failing steps: ${failed.map((s) => s.name).join(", ")}.`);
  return NextResponse.json(
    { job, steps },
    { status: failed.length ? 500 : 200, headers: { "cache-control": "no-store" } },
  );
}

export { handle as GET, handle as POST };
