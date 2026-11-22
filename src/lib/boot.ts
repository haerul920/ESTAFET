import { assertConfig } from "@/lib/config";
import { log } from "@/lib/log";

/**
 * The start-up check, called from `src/instrumentation.ts` (Node.js only).
 * An unsafe configuration in a deployed environment stops the process with exit code 1. Just throwing would leave the
 * server listening and answering every request with an error, which hides the problem from a platform that restarts
 * crashed processes and watches exit codes.
 */
export function bootCheck(): void {
  try {
    if (!process.env.APP_URL && process.env.VERCEL_URL) {
      process.env.APP_URL = `https://${process.env.VERCEL_URL}`;
    }
    if (!process.env.APP_ENV) {
      if (process.env.NODE_ENV === "development") process.env.APP_ENV = "LOCAL";
      else if (process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development")
        process.env.APP_ENV = "DEMO";
    }
    const report = assertConfig();
    for (const w of report.warnings) log.warn("config.warning", { message: w });
    if (report.env === "LOCAL") for (const e of report.errors) log.warn("config.problem", { message: e });
    log.info("server.start", { env: report.env, warnings: report.warnings.length });
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    if (process.env.VERCEL) {
      log.error("config.invalid", { message: e instanceof Error ? e.message : String(e) });
      return;
    }
    // `next dev` keeps the error overlay instead of exiting; a standalone production server exits.
    if (process.env.NODE_ENV === "production") process.exit(1);
    throw e;
  }
}
