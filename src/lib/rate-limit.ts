import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { log, errorFields } from "@/lib/log";
import { environmentName } from "@/lib/admin/env";

/**
 * Rate limits backed by the database (`check_rate_limit`, table `rate_limit_hits`), so they hold across
 * serverless instances. Keys use a hash of the client address, never the address itself.
 */

/** The client address as the host reports it. "local" when there is none (local development). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** A short, stable, one-way identifier for a scope plus a value (an address, an email, an account id). */
export function hashKey(scope: string, value: string): string {
  return createHash("sha256").update(`${scope}:${value.toLowerCase()}`).digest("hex").slice(0, 24);
}

export interface Limit {
  scope: string;
  /** What is being counted: an address, an email, an account id. Hashed before it is stored. */
  identity: string;
  max: number;
  windowSeconds: number;
}

/**
 * True when the action may go ahead. If the database cannot be reached the check fails OPEN and logs a warning,
 * because refusing everyone to sign in is worse than missing a limit for a few minutes.
 */
export async function allow(limit: Limit): Promise<boolean> {
  // Automated tests sign up and sign in far more often than any person. Only a LOCAL server honours the multiplier;
  // the boot check refuses it everywhere else.
  const factor = environmentName() === "LOCAL" ? Math.max(1, Number(process.env.RATE_LIMIT_MULTIPLIER) || 1) : 1;
  try {
    const { data, error } = await createAdminClient().rpc("check_rate_limit", {
      p_key: `${limit.scope}:${hashKey(limit.scope, limit.identity)}`,
      p_max: limit.max * factor,
      p_window_seconds: limit.windowSeconds,
    });
    if (error) {
      log.warn("rate_limit.unavailable", { scope: limit.scope, ...errorFields(error) });
      return true;
    }
    return data === true;
  } catch (e) {
    log.warn("rate_limit.unavailable", { scope: limit.scope, ...errorFields(e) });
    return true;
  }
}
