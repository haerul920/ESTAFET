import { NextResponse, type NextRequest } from "next/server";
import { isProduction } from "@/lib/admin/env";
import {
  ESSENTIAL_TEMPLATES,
  escapeHtml,
  renderEmail,
  SAMPLES,
  TEMPLATES,
  type EmailLocale,
} from "@/lib/email/templates";

/**
 * Preview of the email templates with invented data. Not available in PRODUCTION (404).
 *   /api/dev/email-preview                              list
 *   /api/dev/email-preview?template=moderation&locale=en    one email as HTML  (&format=text for plain text)
 */
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  if (isProduction()) return new NextResponse(null, { status: 404 });
  const q = request.nextUrl.searchParams;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const locale: EmailLocale = q.get("locale") === "en" ? "en" : "id";
  const template = q.get("template");

  if (!template) {
    const rows = TEMPLATES.map(
      (t) =>
        `<li>${escapeHtml(t)}: <a href="?template=${t}&locale=id">id</a> · <a href="?template=${t}&locale=en">en</a> · <a href="?template=${t}&locale=id&format=text">text</a></li>`,
    ).join("");
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><title>Email previews</title><h1>Email previews</h1><ul>${rows}</ul>`,
      {
        headers: { "content-type": "text/html; charset=utf-8" },
      },
    );
  }

  const sample = (SAMPLES as Record<string, Record<string, unknown>>)[template];
  const essential = ESSENTIAL_TEMPLATES.includes(template);
  const mail = sample ? renderEmail(template, locale, sample, { appUrl, name: "Ani", essential }) : null;
  if (!mail) return new NextResponse("Unknown template", { status: 404 });
  if (q.get("format") === "text") {
    return new NextResponse(`Subject: ${mail.subject}\n\n${mail.text}`, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new NextResponse(mail.html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
