import { z } from "zod";

/** Pure settings logic (no server imports) so it can be unit tested. Env vars are defaults, settings override them. */

export const SETTING_KEYS = [
  "allowed_email_domains",
  "max_upload_mb",
  "synthesis_daily_cap",
  "advisor_token_ttl_days",
  "show_demo_banner",
  "registrations_open",
  "contact_email",
  "request_expiry_days",
  "reapply_cooldown_days",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export const SETTING_SCHEMAS = {
  allowed_email_domains: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Use domains like student.unhas.ac.id.")).max(20),
  max_upload_mb: z.number().int("Use a whole number.").min(1, "At least 1 MB.").max(200, "At most 200 MB."),
  synthesis_daily_cap: z.number().int("Use a whole number.").min(1, "At least 1 run.").max(1000, "At most 1000 runs."),
  advisor_token_ttl_days: z.number().int("Use a whole number.").min(1, "At least 1 day.").max(90, "At most 90 days."),
  show_demo_banner: z.boolean(),
  registrations_open: z.boolean(),
  contact_email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address.")]),
  request_expiry_days: z.number().int("Use a whole number.").min(1, "At least 1 day.").max(180, "At most 180 days."),
  reapply_cooldown_days: z.number().int("Use a whole number.").min(0, "Zero turns the cooldown off.").max(90, "At most 90 days."),
} satisfies Record<SettingKey, z.ZodType>;

export interface SettingValues {
  allowed_email_domains: string[];
  max_upload_mb: number;
  synthesis_daily_cap: number;
  advisor_token_ttl_days: number;
  show_demo_banner: boolean;
  registrations_open: boolean;
  contact_email: string;
  request_expiry_days: number;
  reapply_cooldown_days: number;
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
export function envDefaults(env: Record<string, string | undefined>): { [K in SettingKey]: { value: SettingValues[K]; fromEnv: boolean } } {
  const domains = (env.ALLOWED_EMAIL_DOMAINS ?? "").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  return {
    allowed_email_domains: { value: domains, fromEnv: domains.length > 0 },
    max_upload_mb: { value: num(env.MAX_UPLOAD_MB, 25), fromEnv: Boolean(env.MAX_UPLOAD_MB) },
    synthesis_daily_cap: { value: num(env.SYNTHESIS_DAILY_CAP, 20), fromEnv: Boolean(env.SYNTHESIS_DAILY_CAP) },
    advisor_token_ttl_days: { value: num(env.ADVISOR_TOKEN_TTL_DAYS, 14), fromEnv: Boolean(env.ADVISOR_TOKEN_TTL_DAYS) },
    show_demo_banner: { value: true, fromEnv: false },
    registrations_open: { value: true, fromEnv: false },
    contact_email: { value: env.CONTACT_EMAIL ?? "", fromEnv: Boolean(env.CONTACT_EMAIL) },
    request_expiry_days: { value: num(env.REQUEST_EXPIRY_DAYS, 30), fromEnv: Boolean(env.REQUEST_EXPIRY_DAYS) },
    reapply_cooldown_days: { value: env.REAPPLY_COOLDOWN_DAYS !== undefined && env.REAPPLY_COOLDOWN_DAYS !== "" && Number.isFinite(Number(env.REAPPLY_COOLDOWN_DAYS)) ? Number(env.REAPPLY_COOLDOWN_DAYS) : 7, fromEnv: Boolean(env.REAPPLY_COOLDOWN_DAYS) },
  };
}

/** Merges stored rows over env defaults. Invalid stored values are ignored (the default wins). */
export function resolveSettings(rows: { key: string; value: unknown }[], env: Record<string, string | undefined>): EffectiveSettings {
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
