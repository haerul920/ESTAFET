import "server-only";
import { log } from "@/lib/log";

/**
 * Sends one email through the configured provider (EMAIL_PROVIDER):
 *   - `smtp`   any SMTP server (host, user and password from the environment), through nodemailer
 *   - `resend` the Resend HTTP API (plain fetch, no SDK)
 *   - `log`    prints a line and sends nothing (local development and staging; refused in production)
 *   - `none`   refuses to send, so the outbox keeps the mail until a provider is configured
 * A different provider (SES, Postmark, ...) is one more `case` here; the rest of the app does not change.
 */

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Optional one-click unsubscribe target, for non-essential mail. */
  unsubscribeUrl?: string;
}

export class EmailError extends Error {
  /** A short code safe for logs and the database: never an address and never the message text. */
  constructor(readonly code: string) {
    super(code);
    this.name = "EmailError";
  }
}

export function providerName(env: Record<string, string | undefined> = process.env): string {
  return (env.EMAIL_PROVIDER ?? "none").toLowerCase();
}

type Transport = { sendMail: (m: Record<string, unknown>) => Promise<unknown> };
let transport: Transport | null = null;

async function smtp(m: OutgoingEmail) {
  if (!transport) {
    const nodemailer = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
    }) as unknown as Transport;
  }
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to: m.to,
    subject: m.subject,
    text: m.text,
    html: m.html,
    headers: m.unsubscribeUrl ? { "List-Unsubscribe": `<${m.unsubscribeUrl}>` } : undefined,
  });
}

async function resend(m: OutgoingEmail) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [m.to],
      subject: m.subject,
      text: m.text,
      html: m.html,
      headers: m.unsubscribeUrl ? { "List-Unsubscribe": `<${m.unsubscribeUrl}>` } : undefined,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new EmailError(`resend_${res.status}`);
}

/** Throws an EmailError with a short code when the mail could not be handed to the provider. */
export async function sendEmail(m: OutgoingEmail): Promise<void> {
  try {
    switch (providerName()) {
      case "smtp":
        return await smtp(m);
      case "resend":
        return await resend(m);
      case "log":
        // Subject only. Neither the address nor the body is logged.
        log.info("email.log", { subject: m.subject });
        return;
      default:
        throw new EmailError("no_provider");
    }
  } catch (e) {
    if (e instanceof EmailError) throw e;
    // nodemailer and fetch errors can mention the address, so only a code is kept.
    const code = (e as { code?: unknown })?.code;
    throw new EmailError(typeof code === "string" ? `smtp_${code.toLowerCase()}` : "send_failed");
  }
}
