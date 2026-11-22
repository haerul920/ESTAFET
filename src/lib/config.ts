import { z } from "zod";
import { environmentName, type EnvName } from "@/lib/admin/env";
import { pickPublicKey, pickSecretKey } from "@/lib/supabase/keys";

/**
 * Configuration check, run once when the server starts (see `src/instrumentation.ts`).
 *
 * - Values are parsed with Zod, so a typo such as `MAX_UPLOAD_MB=abc` is reported by name.
 * - PRODUCTION refuses unsafe settings: mock AI, demo seeding, a local database, plain http, no bot check, no email,
 *   no cron secret (CLAUDE.md 14.2 and 14.10).
 * - STAGING and DEMO get the same checks except the ones that need paid or external services.
 * - LOCAL only logs problems.
 */

const PROVIDERS = ["gemini", "anthropic", "mock"] as const;
const EMAIL_PROVIDERS = ["none", "log", "smtp", "resend"] as const;

type Env = Record<string, string | undefined>;

/** Treats an empty string like a missing value, which is how `.env` files leave unused keys. */
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalInt = (min: number, max: number) =>
  z.preprocess(blank, z.coerce.number().int().min(min).max(max).optional());

const shape = z.object({
  APP_URL: z.preprocess(blank, z.string().url().optional()),
  LLM_PROVIDER: z.preprocess((v) => blank(v)?.toString().toLowerCase(), z.enum(PROVIDERS).default("mock")),
  EMAIL_PROVIDER: z.preprocess((v) => blank(v)?.toString().toLowerCase(), z.enum(EMAIL_PROVIDERS).default("none")),
  MAX_UPLOAD_MB: optionalInt(1, 100),
  SYNTHESIS_DAILY_CAP: optionalInt(0, 10_000),
  SYNTHESIS_GLOBAL_DAILY_CAP: optionalInt(0, 1_000_000),
  REPORT_HOLD_THRESHOLD: optionalInt(2, 20),
  HOLD_REVIEW_DAYS: optionalInt(1, 30),
  SMTP_PORT: optionalInt(1, 65535),
});

export interface ConfigReport {
  env: EnvName;
  errors: string[];
  warnings: string[];
}

function isLocalUrl(url: string | undefined): boolean {
  return /^(https?:\/\/)?(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])/i.test(url ?? "");
}

export function checkConfig(env: Env = process.env): ConfigReport {
  const name = environmentName(env);
  const errors: string[] = [];
  const warnings: string[] = [];
  const production = name === "PRODUCTION";
  const deployed = name !== "LOCAL";

  const parsed = shape.safeParse(env);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(`${issue.path.join(".")}: ${issue.message}`);
  }
  const v = parsed.success ? parsed.data : undefined;

  // The database. Always needed.
  if (!env.NEXT_PUBLIC_SUPABASE_URL) errors.push("NEXT_PUBLIC_SUPABASE_URL is not set.");
  if (!pickPublicKey(env))
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) is not set.");
  if (!pickSecretKey(env)) errors.push("SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) is not set.");

  if (deployed) {
    if (isLocalUrl(env.NEXT_PUBLIC_SUPABASE_URL))
      errors.push(`${name} must not use a local Supabase URL. Use the hosted project for this environment.`);
    if (!env.APP_URL)
      errors.push("APP_URL is not set. It is needed for links in emails, the sitemap and canonical URLs.");
    else if (!/^https:\/\//i.test(env.APP_URL) || isLocalUrl(env.APP_URL))
      errors.push("APP_URL must be a public https address.");
  }

  if (deployed && env.RATE_LIMIT_MULTIPLIER)
    errors.push("RATE_LIMIT_MULTIPLIER is for local tests only and must not be set in a deployed environment.");

  if (production) {
    if (v?.LLM_PROVIDER === "mock") errors.push("LLM_PROVIDER=mock is refused in PRODUCTION. Use gemini or anthropic.");
    if (/^(true|1|yes)$/i.test(env.SEED_DEMO ?? "")) errors.push("SEED_DEMO=true is refused in PRODUCTION.");
    if (!env.TURNSTILE_SECRET_KEY || !env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
      errors.push(
        "Turnstile keys (TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY) are required in PRODUCTION.",
      );
    if (v && (v.EMAIL_PROVIDER === "none" || v.EMAIL_PROVIDER === "log"))
      errors.push("EMAIL_PROVIDER must be smtp or resend in PRODUCTION, so people receive their emails.");
  } else if (deployed) {
    if (!env.TURNSTILE_SECRET_KEY) warnings.push("No Turnstile keys: guest forms use the weaker local bot check.");
    if (v?.EMAIL_PROVIDER === "none") warnings.push("EMAIL_PROVIDER=none: no email is sent.");
  }

  if (deployed) {
    if ((env.CRON_SECRET ?? "").length < 32)
      errors.push("CRON_SECRET is missing or shorter than 32 characters. Scheduled jobs cannot run safely.");
  }

  // Provider specific keys, checked whenever that provider is chosen.
  if (v?.LLM_PROVIDER === "gemini" && !env.GEMINI_API_KEY) errors.push("LLM_PROVIDER=gemini needs GEMINI_API_KEY.");
  if (v?.LLM_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY)
    errors.push("LLM_PROVIDER=anthropic needs ANTHROPIC_API_KEY.");
  if (v && v.LLM_PROVIDER !== "mock" && !env.LLM_MODEL) errors.push("LLM_MODEL is required with a live LLM provider.");
  if (v?.EMAIL_PROVIDER === "smtp") {
    for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"])
      if (!env[k]) errors.push(`EMAIL_PROVIDER=smtp needs ${k}.`);
  }
  if (v?.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY) errors.push("EMAIL_PROVIDER=resend needs RESEND_API_KEY.");
  if (v && (v.EMAIL_PROVIDER === "smtp" || v.EMAIL_PROVIDER === "resend") && !env.EMAIL_FROM)
    errors.push("EMAIL_FROM is required with an email provider.");

  if (production && !env.ALERT_WEBHOOK_URL)
    warnings.push("ALERT_WEBHOOK_URL is not set: alerts (failed emails, cap reached) are only written to the logs.");

  return { env: name, errors, warnings };
}

/**
 * Throws when the configuration is unsafe for a deployed environment. LOCAL never throws, so a developer
 * can start the app with a partial `.env.local`. Returns the report so the caller can log warnings.
 */
export function assertConfig(env: Env = process.env): ConfigReport {
  const report = checkConfig(env);
  if (report.env !== "LOCAL" && report.errors.length > 0) {
    throw new Error(
      `Refusing to start in ${report.env}. Fix the configuration:\n${report.errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }
  return report;
}
