import { createTranslator } from "next-intl";
import idMessages from "../../../messages/id.json";
import enMessages from "../../../messages/en.json";

/**
 * Email templates. The words live in `messages/{id,en}.json` under `email.*` (so the CI key check covers them and the
 * glossary stays the same as in the app). This file only decides which words and which link each email gets, and
 * builds a plain text and an HTML version.
 *
 * Every value that came from a person (project title, team name, reason, note) is escaped for HTML and cut to a
 * safe length. Subjects are one line. Nothing here talks to the network, so it is easy to test.
 */

export type EmailLocale = "id" | "en";

export interface RenderContext {
  /** Public address of the site, for links. */
  appUrl: string;
  /** The recipient's name, if known. */
  name?: string | null;
  /** Essential emails (safety, account) are sent even when the person turned notification emails off. */
  essential: boolean;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

type Tr = (key: string, values?: Record<string, string | number>) => string;
type Payload = Record<string, unknown>;

const translators = new Map<EmailLocale, Tr>();
function translator(locale: EmailLocale): Tr {
  let t = translators.get(locale);
  if (!t) {
    const messages = (locale === "en" ? enMessages : idMessages) as unknown as Record<string, unknown>;
    t = createTranslator({ locale, messages, namespace: "email" } as never) as unknown as Tr;
    translators.set(locale, t);
  }
  return t;
}

/** A payload value as short plain text. Missing or non-text values become the empty string. */
function str(v: unknown, max = 300): string {
  if (typeof v !== "string" && typeof v !== "number") return "";
  const s = String(v).replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Content {
  subject: string;
  paragraphs: string[];
  ctaKey: "dashboard" | "myReports" | "decision" | "admin";
  /** Path without the language prefix. */
  path: string;
}

/** Which words and link each template uses. Returns null for a template that is not an email. */
function compose(template: string, p: Payload, t: Tr): Content | null {
  const title = str(p.title, 160) || t("common.aProject");
  switch (template) {
    case "new_request": {
      const team = str(p.team, 120) || "—";
      return {
        subject: t("new_request.subject", { title }),
        paragraphs: [t("new_request.intro", { team, title }), t("new_request.detail")],
        ctaKey: "dashboard",
        path: "/dasbor",
      };
    }
    case "request_decision": {
      const k = p.decision === "approved" ? "approved" : "declined";
      const note = str(p.note, 400);
      return {
        subject: t(`request_decision.${k}.subject`, { title }),
        paragraphs: [
          t(`request_decision.${k}.intro`, { title }),
          ...(note ? [t("common.ownerNote", { note })] : []),
          t(`request_decision.${k}.detail`),
        ],
        ctaKey: "dashboard",
        path: "/dasbor",
      };
    }
    case "agreement_accepted": {
      const side = p.side === "creator" ? "creator" : "adopter";
      return {
        subject: t(`agreement_accepted.${side}.subject`, { title }),
        paragraphs: [t(`agreement_accepted.${side}.intro`, { title }), t(`agreement_accepted.${side}.detail`)],
        ctaKey: "dashboard",
        path: "/dasbor",
      };
    }
    case "moderation": {
      // The database writes hold, hide, remove and restore; older rows may say held, hidden, removed.
      const raw = str(p.action, 20).toLowerCase();
      const act = raw.startsWith("remov")
        ? "remove"
        : raw.startsWith("hid")
          ? "hide"
          : raw.startsWith("hold") || raw === "held"
            ? "hold"
            : "restore";
      const reason = str(p.reason, 500);
      return {
        subject: t(`moderation.${act}.subject`, { title }),
        paragraphs: [
          t(`moderation.${act}.intro`, { title }),
          ...(reason ? [t("moderation.reason", { reason })] : []),
          ...(act === "restore" ? [] : [t("moderation.appeal")]),
        ],
        ctaKey: "decision",
        path: str(p.slug, 120) ? `/proyek/${encodeURIComponent(str(p.slug, 120))}/keputusan` : "/dasbor",
      };
    }
    case "appeal_outcome": {
      const k = p.outcome === "accepted" ? "accepted" : "rejected";
      const note = str(p.note, 500);
      const slug = str(p.slug, 120);
      return {
        subject: t(`appeal_outcome.${k}.subject`, { title }),
        paragraphs: [t(`appeal_outcome.${k}.intro`, { title }), ...(note ? [t("appeal_outcome.note", { note })] : [])],
        ctaKey: "decision",
        path: slug ? `/proyek/${encodeURIComponent(slug)}/keputusan` : "/dasbor",
      };
    }
    case "access_revoked": {
      const reason = str(p.reason, 500);
      return {
        subject: t("access_revoked.subject", { title }),
        paragraphs: [
          t("access_revoked.intro", { title }),
          ...(reason ? [t("access_revoked.reason", { reason })] : []),
          t("access_revoked.detail"),
        ],
        ctaKey: "dashboard",
        path: "/dasbor",
      };
    }
    case "team_invite":
    case "ownership_offer": {
      const slug = str(p.slug, 120);
      return {
        subject: t(`${template}.subject`, { title }),
        paragraphs: [t(`${template}.intro`, { title }), t(`${template}.detail`)],
        ctaKey: "dashboard",
        path: template === "ownership_offer" && slug ? `/proyek/${encodeURIComponent(slug)}/pengaturan` : "/dasbor",
      };
    }
    case "report_outcome": {
      const reference = str(p.reference, 40) || "—";
      const k = p.outcome === "resolved" ? "resolved" : "dismissed";
      return {
        subject: t("report_outcome.subject", { reference }),
        paragraphs: [t(`report_outcome.${k}`, { reference }), t("report_outcome.detail")],
        ctaKey: "myReports",
        path: "/laporan-saya",
      };
    }
    case "admin_hold": {
      const reason = str(p.reason, 500);
      return {
        subject: t("admin_hold.subject", { title }),
        paragraphs: [t("admin_hold.intro", { title }), ...(reason ? [t("admin_hold.detail", { reason })] : [])],
        ctaKey: "admin",
        path: str(p.project_id, 60) ? `/admin/projects/${encodeURIComponent(str(p.project_id, 60))}` : "/admin",
      };
    }
    case "admin_hold_overdue":
      return {
        subject: t("admin_hold_overdue.subject", { title }),
        paragraphs: [t("admin_hold_overdue.intro", { title }), t("admin_hold_overdue.detail")],
        ctaKey: "admin",
        path: str(p.project_id, 60) ? `/admin/projects/${encodeURIComponent(str(p.project_id, 60))}` : "/admin",
      };
    case "admin_appeal":
      return {
        subject: t("admin_appeal.subject", { title }),
        paragraphs: [t("admin_appeal.intro", { title }), t("admin_appeal.detail")],
        ctaKey: "admin",
        path: "/admin/appeals",
      };
    default:
      return null;
  }
}

/** The templates that exist, for the preview page and for tests. */
export const TEMPLATES = [
  "new_request",
  "request_decision",
  "agreement_accepted",
  "moderation",
  "appeal_outcome",
  "access_revoked",
  "team_invite",
  "ownership_offer",
  "report_outcome",
  "admin_hold",
  "admin_hold_overdue",
  "admin_appeal",
] as const;
/** Safety and account emails. They ignore the "no notification emails" preference. Must match `enqueue_emails()` in the database. */
export const ESSENTIAL_TEMPLATES: readonly string[] = [
  "moderation",
  "appeal_outcome",
  "access_revoked",
  "admin_hold",
  "admin_hold_overdue",
  "admin_appeal",
];
export type TemplateName = (typeof TEMPLATES)[number];

/** Example data for the preview page. Invented, never real people. */
export const SAMPLES: Record<TemplateName, Payload> = {
  new_request: { title: "Penghitung Terumbu Karang", team: "Tim Pesisir" },
  request_decision: {
    title: "Penghitung Terumbu Karang",
    decision: "approved",
    note: "Semoga lancar, hubungi kami jika ada kendala.",
  },
  agreement_accepted: { title: "Penghitung Terumbu Karang", side: "creator" },
  moderation: {
    title: "Penghitung Terumbu Karang",
    action: "hide",
    reason: "Berkas laporan memuat data pribadi peserta survei.",
    slug: "penghitung-terumbu-karang",
  },
  appeal_outcome: {
    title: "Penghitung Terumbu Karang",
    outcome: "accepted",
    note: "Data pribadi sudah dihapus.",
    slug: "penghitung-terumbu-karang",
  },
  access_revoked: { title: "Penghitung Terumbu Karang", reason: "Berkas dibagikan ke pihak luar." },
  team_invite: { title: "Penghitung Terumbu Karang" },
  ownership_offer: { title: "Penghitung Terumbu Karang", slug: "penghitung-terumbu-karang" },
  report_outcome: { reference: "LP-1A2B3C4D", outcome: "resolved" },
  admin_hold: {
    title: "Penghitung Terumbu Karang",
    reason: "Tiga pelapor berbeda melaporkan hak cipta.",
    project_id: "00000000-0000-0000-0000-000000000000",
  },
  admin_hold_overdue: { title: "Penghitung Terumbu Karang", project_id: "00000000-0000-0000-0000-000000000000" },
  admin_appeal: { title: "Penghitung Terumbu Karang" },
};

const INK = "#0E1A26";
const BLUE = "#1760D6";
const MUTED = "#4A5A66";

/** Builds the subject, the plain text and the HTML for one email. Returns null for an unknown template. */
export function renderEmail(
  template: string,
  locale: EmailLocale,
  payload: Payload,
  ctx: RenderContext,
): RenderedEmail | null {
  const t = translator(locale);
  const content = compose(template, payload, t);
  if (!content) return null;

  const base = ctx.appUrl.replace(/\/+$/, "");
  const prefix = locale === "en" ? "/en" : "";
  const link = `${base}${prefix}${content.path}`;
  const prefsLink = `${base}${prefix}/akun/privasi`;
  const name = str(ctx.name, 80);
  const greeting = name ? t("common.greeting", { name }) : t("common.greetingNoName");
  const cta = t(`cta.${content.ctaKey}`);
  const subject = content.subject.replace(/\s+/g, " ").trim().slice(0, 200);
  const footer = ctx.essential ? t("common.footerEssential") : t("common.footerPrefs");

  const text = [
    greeting,
    "",
    ...content.paragraphs.flatMap((p) => [p, ""]),
    `${cta}: ${link}`,
    "",
    t("common.signature"),
    "",
    "--",
    footer,
    ...(ctx.essential ? [] : [prefsLink]),
  ].join("\n");

  const para = (s: string) =>
    `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:${INK}">${escapeHtml(s)}</p>`;
  const html = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Instrument Sans',Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(content.paragraphs[0] ?? subject)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:24px">
<tr><td style="padding:28px 28px 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${BLUE};font-weight:600">ESTAFET</td></tr>
<tr><td style="padding:8px 28px 4px">
${para(greeting)}
${content.paragraphs.map(para).join("\n")}
<p style="margin:22px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:${BLUE};color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:14px 26px;border-radius:999px">${escapeHtml(cta)}</a></p>
<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:${MUTED}">${escapeHtml(t("common.fallbackLink", { url: link }))}</p>
<p style="margin:0 0 6px;font-size:16px;color:${INK}">${escapeHtml(t("common.signature"))}</p>
</td></tr>
<tr><td style="padding:16px 28px 28px;border-top:1px solid #DDE1E5;font-size:12px;line-height:1.5;color:${MUTED}">
${escapeHtml(footer)}${ctx.essential ? "" : ` <a href="${escapeHtml(prefsLink)}" style="color:${BLUE}">${escapeHtml(t("common.footerPrefsLink"))}</a>`}
</td></tr>
</table></td></tr></table>
</body></html>`;

  return { subject, text, html };
}
