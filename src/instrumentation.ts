import type { Instrumentation } from "next";

/** Runs once when the server starts. An unsafe deployed configuration stops the boot here (CLAUDE.md 14.10). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertConfig } = await import("@/lib/config");
  const { log } = await import("@/lib/log");
  try {
    const report = assertConfig();
    for (const w of report.warnings) log.warn("config.warning", { message: w });
    if (report.env === "LOCAL") for (const e of report.errors) log.warn("config.problem", { message: e });
    log.info("server.start", { env: report.env, warnings: report.warnings.length });
  } catch (e) {
    // Print the full reason, then fail the boot.
    console.error(e instanceof Error ? e.message : e);
    throw e;
  }
}

/** Unhandled errors in pages, actions and route handlers. Only the route and the error class are logged. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { log, errorFields } = await import("@/lib/log");
  log.error("request.error", {
    ...errorFields(error),
    path: request.path.split("?")[0],
    method: request.method,
    route: context.routePath,
    kind: context.routeType,
    digest: (error as { digest?: string }).digest,
  });
};
