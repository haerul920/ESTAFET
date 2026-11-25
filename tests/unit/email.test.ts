import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ESSENTIAL_TEMPLATES, SAMPLES, TEMPLATES, escapeHtml, renderEmail } from "@/lib/email/templates";

const ctx = { appUrl: "https://estafet.example/", name: "Ani", essential: false };

describe("every template renders in both languages", () => {
  for (const template of TEMPLATES) {
    for (const locale of ["id", "en"] as const) {
      it(`${template} (${locale})`, () => {
        const essential = ESSENTIAL_TEMPLATES.includes(template);
        const mail = renderEmail(template, locale, SAMPLES[template], { ...ctx, essential })!;
        expect(mail).not.toBeNull();
        for (const part of [mail.subject, mail.text, mail.html]) {
          expect(part).not.toMatch(/undefined|\[object|\{[a-z_]+\}/i);
        }
        expect(mail.subject.length).toBeGreaterThan(5);
        expect(mail.subject).not.toMatch(/\n/);
        expect(mail.html).toContain(`<html lang="${locale}">`);
        // Links carry the language prefix for English only, and no double slash after the host.
        const prefix = locale === "en" ? "https://estafet.example/en/" : "https://estafet.example/";
        expect(mail.text).toContain(prefix);
        expect(mail.text).not.toContain("example//");
      });
    }
  }

  it("the Indonesian and English subjects differ", () => {
    for (const template of TEMPLATES) {
      const id = renderEmail(template, "id", SAMPLES[template], ctx)!.subject;
      const en = renderEmail(template, "en", SAMPLES[template], ctx)!.subject;
      expect(id, template).not.toBe(en);
    }
  });

  it("the Indonesian text addresses the reader as kamu", () => {
    const mail = renderEmail("request_decision", "id", SAMPLES.request_decision, ctx)!;
    expect(mail.text).toMatch(/Halo Ani,/);
    expect(mail.text).toMatch(/kamu|mu\b/i);
  });
});

describe("content from people is never trusted", () => {
  it("escapes HTML in titles, teams and reasons", () => {
    const mail = renderEmail(
      "moderation",
      "en",
      { title: `<script>alert(1)</script>`, action: "hide", reason: `"><img src=x onerror=alert(1)>` },
      { ...ctx, essential: true },
    )!;
    expect(mail.html).not.toContain("<script>alert");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("keeps the subject on one line even when the title tries to add headers", () => {
    const mail = renderEmail("new_request", "en", { title: "Hi\r\nBcc: someone@example.com", team: "T" }, ctx)!;
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });

  it("cuts very long values", () => {
    const mail = renderEmail("new_request", "en", { title: "x".repeat(5000), team: "T" }, ctx)!;
    expect(mail.subject.length).toBeLessThanOrEqual(200);
    expect(mail.text.length).toBeLessThan(2000);
  });

  it("does not put a link in the email that points elsewhere than the site", () => {
    const mail = renderEmail("appeal_outcome", "id", { title: "T", outcome: "accepted", slug: "../../evil?x=1" }, ctx)!;
    expect(mail.text).toContain("https://estafet.example/proyek/..%2F..%2Fevil%3Fx%3D1/keputusan");
  });

  it("escapeHtml covers the five characters", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});

describe("behaviour", () => {
  it("returns null for a notification that is not an email", () => {
    expect(renderEmail("item_progress", "id", {}, ctx)).toBeNull();
  });

  it("essential mail says why it was sent and has no unsubscribe link; others link to the settings", () => {
    const essential = renderEmail("moderation", "en", SAMPLES.moderation, { ...ctx, essential: true })!;
    expect(essential.text).toContain("is sent even if you turned notification emails off");
    expect(essential.text).not.toContain("/akun/setelan");
    const normal = renderEmail("new_request", "en", SAMPLES.new_request, ctx)!;
    expect(normal.text).toContain("https://estafet.example/en/akun/setelan");
  });

  it("works without a name", () => {
    const mail = renderEmail("team_invite", "id", { title: "T" }, { ...ctx, name: null })!;
    expect(mail.text.startsWith("Halo,")).toBe(true);
  });

  it("a moderation action written in either style maps to the same wording", () => {
    const a = renderEmail("moderation", "en", { title: "T", action: "remove" }, ctx)!;
    const b = renderEmail("moderation", "en", { title: "T", action: "removed" }, ctx)!;
    expect(a.subject).toBe(b.subject);
  });
});

describe("the list of essential emails matches the database", () => {
  it("enqueue_emails() treats exactly the same templates as essential", () => {
    const sql = readFileSync("supabase/migrations/20261125000001_r7_production.sql", "utf8");
    const lists = [...sql.matchAll(/nt\.type in \(([^)]*)\)/g)].map((m) =>
      [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort(),
    );
    // The first list is the essential flag; the second is the preference override (same list); the last is "which types become mail".
    const essentialSql = lists[0];
    expect(essentialSql).toEqual([...ESSENTIAL_TEMPLATES].sort());
    const queued = lists[lists.length - 1];
    // Every queued type has a template, and every template (except the report outcome, which comes from the reports table) is queued.
    expect(queued).toEqual(TEMPLATES.filter((t) => t !== "report_outcome").sort());
  });
});
