import { createHmac, timingSafeEqual } from "node:crypto";

/** Signed re-authentication proof stored in an httpOnly cookie: "userId.issuedAtMs.signature". */
export const REAUTH_COOKIE = "estafet_reauth";
export const REAUTH_MINUTES = 15;

function secret(): string {
  return (
    process.env.REAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "dev-only-reauth-secret"
  );
}

export function signReauth(userId: string, now: number = Date.now()): string {
  const payload = `${userId}.${now}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyReauth(
  value: string | undefined,
  userId: string,
  minutes: number = REAUTH_MINUTES,
  now: number = Date.now(),
): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [uid, issued, sig] = parts;
  if (uid !== userId) return false;
  const expected = createHmac("sha256", secret()).update(`${uid}.${issued}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const age = now - Number(issued);
  return Number.isFinite(age) && age >= 0 && age <= minutes * 60_000;
}
