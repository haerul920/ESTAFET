export type EnvName = "LOCAL" | "STAGING" | "PRODUCTION";

/** APP_ENV wins. Otherwise a local Supabase URL means LOCAL, anything else is treated as PRODUCTION (safe default). */
export function environmentName(env: Record<string, string | undefined> = process.env): EnvName {
  const explicit = env.APP_ENV?.toUpperCase();
  if (explicit === "LOCAL" || explicit === "STAGING" || explicit === "PRODUCTION") return explicit;
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return /^(https?:\/\/)?(127\.0\.0\.1|localhost)/.test(url) ? "LOCAL" : "PRODUCTION";
}

export function isProduction(env: Record<string, string | undefined> = process.env): boolean {
  return environmentName(env) === "PRODUCTION";
}
