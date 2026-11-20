import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, URL-safe. Only the hash is stored in the database. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenTtlDays(): number {
  const d = Number(process.env.ADVISOR_TOKEN_TTL_DAYS);
  return Number.isFinite(d) && d > 0 ? d : 14;
}

export function tokenExpiry(from: Date = new Date(), days: number = tokenTtlDays()): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

/** Tokens are base64url, 43 chars for 32 bytes. Anything else is rejected before touching the database. */
export function looksLikeToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{16,128}$/.test(token);
}
