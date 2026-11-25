import { z } from "zod";

/** Pure settings logic (no server imports) so it can be unit tested. Env vars are defaults, settings override them. */

/** The official address of ESTAFET (owner decision, CLAUDE.md 15.10). */
export const OFFICIAL_CONTACT_EMAIL = "estafet.info@gmail.com";

export const SETTING_KEYS = [
  "allowed_email_domains",
  "max_upload_mb",
  "synthesis_daily_cap",
  "show_demo_banner",
  "registrations_open",
  "contact_email",
  "request_expiry_days",
  "reapply_cooldown_days",
  "report_hold_threshold",
  "hold_review_days",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export const SETTING_SCHEMAS = {
  allowed_email_domains: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "domains"),
    )
    .max(20),
  // The private storage bucket takes at most 50 MB, so a larger setting could not be honoured.
  max_upload_mb: z.number().int("whole").min(1, "mb_min").max(50, "mb_max"),
  synthesis_daily_cap: z.number().int("whole").min(1, "runs_min").max(1000, "runs_max"),
  show_demo_banner: z.boolean(),
  registrations_open: z.boolean(),
  contact_email: z.union([z.literal(""), z.string().trim().email("email")]),
  request_expiry_days: z.number().int("whole").min(1, "days_min").max(180, "days_max180"),
  reapply_cooldown_days: z.number().int("whole").min(0, "cooldown_min").max(90, "cooldown_max"),
  report_hold_threshold: z.number().int("whole").min(2, "reporters_min").max(20, "reporters_max"),
  hold_review_days: z.number().int("whole").min(1, "days_min").max(30, "review_max"),
} satisfies Record<SettingKey, z.ZodType>;

export interface SettingValues {
  allowed_email_domains: string[];
  max_upload_mb: number;
  synthesis_daily_cap: number;
  show_demo_banner: boolean;
  registrations_open: boolean;
  contact_email: string;
  request_expiry_days: number;
  reapply_cooldown_days: number;
  report_hold_threshold: number;
  hold_review_days: number;
}

export interface EffectiveSetting<T> {
  value: T;
  source: "setting" | "env" | "default";
  /** What the value would be without an override. */
  fallback: T;
}
export type EffectiveSettings = { [K in SettingKey]: EffectiveSetting<SettingValues[K]> };

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** The value from env (or the built-in default) for each key. */
function envDefaults(env: Record<string, string | undefined>): {
  [K in SettingKey]: { value: SettingValues[K]; fromEnv: boolean };
} {
  const domains = (env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return {
    allowed_email_domains: { value: domains, fromEnv: domains.length > 0 },
    max_upload_mb: { value: num(env.MAX_UPLOAD_MB, 50), fromEnv: Boolean(env.MAX_UPLOAD_MB) },
    synthesis_daily_cap: { value: num(env.SYNTHESIS_DAILY_CAP, 20), fromEnv: Boolean(env.SYNTHESIS_DAILY_CAP) },
    show_demo_banner: { value: true, fromEnv: false },
    registrations_open: { value: true, fromEnv: false },
    contact_email: { value: env.CONTACT_EMAIL || OFFICIAL_CONTACT_EMAIL, fromEnv: Boolean(env.CONTACT_EMAIL) },
    request_expiry_days: { value: num(env.REQUEST_EXPIRY_DAYS, 30), fromEnv: Boolean(env.REQUEST_EXPIRY_DAYS) },
    reapply_cooldown_days: {
      value:
        env.REAPPLY_COOLDOWN_DAYS !== undefined &&
        env.REAPPLY_COOLDOWN_DAYS !== "" &&
        Number.isFinite(Number(env.REAPPLY_COOLDOWN_DAYS))
          ? Number(env.REAPPLY_COOLDOWN_DAYS)
          : 7,
      fromEnv: Boolean(env.REAPPLY_COOLDOWN_DAYS),
    },
    report_hold_threshold: { value: num(env.REPORT_HOLD_THRESHOLD, 3), fromEnv: Boolean(env.REPORT_HOLD_THRESHOLD) },
    hold_review_days: { value: num(env.HOLD_REVIEW_DAYS, 3), fromEnv: Boolean(env.HOLD_REVIEW_DAYS) },
  };
}

/** Merges stored rows over env defaults. Invalid stored values are ignored (the default wins). */
export function resolveSettings(
  rows: { key: string; value: unknown }[],
  env: Record<string, string | undefined>,
): EffectiveSettings {
  const defaults = envDefaults(env);
  const out = {} as Record<string, EffectiveSetting<unknown>>;
  for (const key of SETTING_KEYS) {
    const d = defaults[key];
    const row = rows.find((r) => r.key === key);
    const parsed = row ? SETTING_SCHEMAS[key].safeParse(row.value) : null;
    if (parsed?.success) out[key] = { value: parsed.data, source: "setting", fallback: d.value };
    else out[key] = { value: d.value, source: d.fromEnv ? "env" : "default", fallback: d.value };
  }
  return out as EffectiveSettings;
}

export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

export function isEmailAllowedBy(email: string, domains: string[]): boolean {
  if (domains.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return domains.some((d) => domain === d || domain.endsWith("." + d));
}

/**
 * The platform-wide limit for live AI runs in 24 hours (all people together). From the environment, because it protects
 * the bill and should not be changed by a click in the admin area. Default 300; a bad value falls back to the default.
 */
export function globalSynthesisCap(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.SYNTHESIS_GLOBAL_DAILY_CAP);
  return Number.isInteger(n) && n >= 0 ? n : 300;
}
