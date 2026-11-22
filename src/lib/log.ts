/**
 * Structured logs (one JSON object per line) for the host's log drain.
 *
 * Rules (CLAUDE.md 14.10):
 * - No personal data and no file contents. Pass ids, counts, codes and durations, never names, emails, text or tokens.
 * - `scrub` drops fields that are likely to hold such data, as a second line of defence.
 * - Alerts: `alert()` writes an error line with `alert: true` and, when ALERT_WEBHOOK_URL is set, posts a short message.
 */

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const BLOCKED =
  /(email|password|token|secret|authorization|cookie|name|text|content|quote|body|details|reason|phone|ip$)/i;

/** Removes blocked keys and shortens long strings. Exported for tests. */
export function scrub(fields: Fields, depth = 0): Fields {
  const out: Fields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (BLOCKED.test(key) && !/^(request_id|reference|error_name)$/i.test(key)) continue;
    if (typeof value === "string") out[key] = value.length > 200 ? `${value.slice(0, 200)}…` : value;
    else if (value && typeof value === "object" && !Array.isArray(value) && depth < 2)
      out[key] = scrub(value as Fields, depth + 1);
    else if (Array.isArray(value)) out[key] = value.slice(0, 20).map((v) => (typeof v === "object" ? "[object]" : v));
    else out[key] = value;
  }
  return out;
}

function write(level: Level, event: string, fields: Fields = {}) {
  if (process.env.NODE_ENV === "test") return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...scrub(fields) });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const log = {
  debug: (event: string, fields?: Fields) => write("debug", event, fields),
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};

/** An error as safe log fields: its class and a short message. Stack traces stay out of the drain. */
export function errorFields(e: unknown): Fields {
  if (e instanceof Error) return { error_name: e.name, message: e.message.slice(0, 200) };
  return { error_name: typeof e };
}

/** A condition the team should hear about. Always logged; posted to the webhook when one is configured. */
export async function alert(code: string, summary: string, fields: Fields = {}): Promise<void> {
  write("error", `alert.${code}`, { alert: true, summary, ...fields });
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    // `text` works for Slack and Discord-compatible webhooks (Discord reads `content`, so both are sent).
    const text = `[ESTAFET ${process.env.APP_ENV ?? ""}] ${code}: ${summary}`;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // A failing webhook must never break the request that raised the alert.
  }
}
