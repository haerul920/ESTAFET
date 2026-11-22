/**
 * The public Supabase key goes by two names: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (older projects) and
 * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (newer projects, keys that start with `sb_publishable_`).
 * Either one works. Each name is written out in full because Next.js only puts a variable into the browser
 * bundle when it is spelled out in the source.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_PUBLIC_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!;

/** The same rule for tests and scripts that pass an environment object. */
export function pickPublicKey(env: Record<string, string | undefined>): string | undefined {
  return env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined;
}

/** The private key: `SUPABASE_SERVICE_ROLE_KEY` (older) or `SUPABASE_SECRET_KEY` (newer, `sb_secret_...`). Server only. */
export function pickSecretKey(env: Record<string, string | undefined>): string | undefined {
  return env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || undefined;
}

/**
 * Options for the Supabase session cookies. `SameSite=Lax` blocks cross-site form posts; `Secure` is set whenever the
 * site is served over HTTPS (the server knows from APP_URL, the browser from its own address). The cookies are not
 * `HttpOnly` on purpose: the browser client reads the session from them.
 */
export function sessionCookieOptions(): { sameSite: "lax"; secure: boolean; path: string } {
  const secure =
    typeof window !== "undefined"
      ? window.location.protocol === "https:"
      : (process.env.APP_URL ?? "").startsWith("https://");
  return { sameSite: "lax", secure, path: "/" };
}
