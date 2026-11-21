/**
 * Bot check for guest forms (CLAUDE.md 14.10, "bot check for guests").
 *
 * - With `TURNSTILE_SECRET_KEY` set, the Cloudflare Turnstile token is verified with Cloudflare.
 * - Without it, a local check runs: a hidden "honeypot" field must stay empty and the form must have been open for a few
 *   seconds. This stops simple scripts, not determined attackers. It is a fallback for local use and demos.
 *
 * The Turnstile path needs real keys and network access and has NOT been tested against Cloudflare.
 */
export const MIN_FILL_MS = 3000;
export const MAX_FILL_MS = 2 * 60 * 60 * 1000;

export interface BotSignals {
  /** Value of the hidden honeypot field. Humans never see it, so it must be empty. */
  honeypot: string;
  /** `Date.now()` when the form was shown, as sent by the page. */
  startedAt: number;
  /** The Turnstile response token, if the widget was shown. */
  token?: string;
}

/** The local check as a pure function (easy to test). */
export function localBotCheck(signals: Pick<BotSignals, "honeypot" | "startedAt">, now = Date.now()): boolean {
  if (signals.honeypot.trim() !== "") return false;
  const elapsed = now - signals.startedAt;
  return Number.isFinite(elapsed) && elapsed >= MIN_FILL_MS && elapsed <= MAX_FILL_MS;
}

export function turnstileEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY);
}

/** Reads the signals from a submitted form. */
export function botSignalsFrom(formData: FormData): BotSignals {
  return {
    honeypot: String(formData.get("website") ?? ""),
    startedAt: Number(formData.get("started_at") ?? 0),
    token: String(formData.get("cf-turnstile-response") ?? "") || undefined,
  };
}

/** True when the visitor passes. Signed-in, verified people skip this check (the caller decides). */
export async function verifyBot(signals: BotSignals, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return localBotCheck(signals);
  if (!signals.token) return false;
  try {
    const body = new URLSearchParams({ secret, response: signals.token });
    if (remoteIp && remoteIp !== "local") body.set("remoteip", remoteIp);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
