import { environmentName } from "@/lib/admin/env";
import { assertConfig } from "@/lib/config";
import { log } from "@/lib/log";

type Env = Record<string, string | undefined>;

/**
 * Fills values that Vercel already knows when they were not set by hand:
 * - `APP_URL` from the production domain (production) or the deployment URL (previews).
 * - `APP_ENV`: LOCAL under `next dev`, DEMO on Vercel previews. A Vercel production deployment without `APP_ENV`
 *   stays unset, so `environmentName()` treats it as PRODUCTION (the safe default).
 */
export function applyPlatformDefaults(env: Env = process.env): void {
  if (!env.APP_URL) {
    const host =
      env.VERCEL_ENV === "production" ? (env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL) : env.VERCEL_URL;
    if (host) env.APP_URL = `https://${host}`;
  }
  if (!env.APP_ENV) {
    if (env.NODE_ENV === "development") env.APP_ENV = "LOCAL";
    else if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") env.APP_ENV = "DEMO";
  }
}

/**
 * The start-up check, called from `src/instrumentation.ts` (Node.js only).
 *
 * - A standalone production server (`next start`) exits with code 1 on an unsafe configuration. Just throwing would
 *   leave it listening and answering every request with an error, which hides the problem from a platform that
 *   restarts crashed processes and watches exit codes.
 * - On Vercel there is no long-lived process to exit. PRODUCTION still refuses to serve (CLAUDE.md 14.2 and 14.10):
 *   the error is rethrown so `register()` fails and the deployment answers with errors instead of running with mock
 *   AI, demo seeding, no bot check or no email. DEMO and STAGING on Vercel only log the problem, so a preview with a
 *   partial configuration still opens.
 */
export function bootCheck(env: Env = process.env): void {
  applyPlatformDefaults(env);
  try {
    const report = assertConfig(env);
    for (const w of report.warnings) log.warn("config.warning", { message: w });
    if (report.env === "LOCAL") for (const e of report.errors) log.warn("config.problem", { message: e });
    log.info("server.start", { env: report.env, warnings: report.warnings.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(message);
    if (env.VERCEL && environmentName(env) !== "PRODUCTION") {
      log.error("config.invalid", { message });
      return;
    }
    // `next dev` keeps the error overlay instead of exiting; a standalone production server exits.
    if (env.NODE_ENV === "production" && !env.VERCEL) process.exit(1);
    throw e;
  }
}
