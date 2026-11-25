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
 * - Only a DECLARED production (`APP_ENV=PRODUCTION`) refuses an unsafe configuration (CLAUDE.md 14.2 and 14.10).
 *   A standalone server (`next start`) then exits with code 1; on Vercel, where there is no long-lived process to exit,
 *   the error is rethrown so `register()` fails.
 * - Without `APP_ENV` a hosted deployment still counts as PRODUCTION (no "demo" labels, no styleguide, no purge, indexed),
 *   but an incomplete configuration is only logged as `config.invalid` and shown to admins on /admin, so the site keeps
 *   serving. Team decision, 2026-11-23: the site went down with HTTP 500 on every route while APP_ENV was not set.
 * - DEMO and STAGING only log the problem, so a preview with a partial configuration still opens.
 */
export function bootCheck(env: Env = process.env): void {
  const declared = Boolean(env.APP_ENV?.trim());
  applyPlatformDefaults(env);
  try {
    const report = assertConfig(env);
    for (const w of report.warnings) log.warn("config.warning", { message: w });
    if (report.env === "LOCAL") for (const e of report.errors) log.warn("config.problem", { message: e });
    log.info("server.start", { env: report.env, warnings: report.warnings.length });
  } catch (e) {
    const name = environmentName(env);
    if (name === "PRODUCTION" && !declared) {
      const message = (e instanceof Error ? e.message : String(e)).replace(
        /^Refusing to start in PRODUCTION\. Fix the configuration:/,
        "Unsafe PRODUCTION configuration (APP_ENV is not set, so the site keeps serving). Set APP_ENV=PRODUCTION to enforce these rules, or APP_ENV=DEMO for a demo site:",
      );
      console.error(message);
      log.error("config.invalid", { message });
      return;
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error(message);
    if (env.VERCEL && name !== "PRODUCTION") {
      log.error("config.invalid", { message });
      return;
    }
    // `next dev` keeps the error overlay instead of exiting; a standalone production server exits.
    if (env.NODE_ENV === "production" && !env.VERCEL) process.exit(1);
    throw e;
  }
}
