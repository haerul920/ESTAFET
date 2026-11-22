import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, makeUser, svc, type TestUser } from "./helpers";
import { decodeQuotedPrintable, startSmtpSink, type SmtpSink } from "../helpers/smtp-sink";

/**
 * The email sender end to end, against the LOCAL database and a fake SMTP server on this machine:
 * a notification becomes an outbox row, the dispatcher sends it through SMTP, and the result is recorded.
 * No real email leaves the machine.
 */
let sink: SmtpSink;
let ann: TestUser;
let dispatchEmails: typeof import("@/lib/email/dispatch").dispatchEmails;

const outbox = async (userId: string) =>
  (await svc.from("email_outbox").select("*").eq("user_id", userId).order("created_at")).data ?? [];

beforeAll(async () => {
  sink = await startSmtpSink();
  Object.assign(process.env, {
    EMAIL_PROVIDER: "smtp",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(sink.port),
    SMTP_USER: "u",
    SMTP_PASSWORD: "p",
    EMAIL_FROM: "ESTAFET <halo@estafet.test>",
    APP_URL: "https://estafet.test",
  });
  ({ dispatchEmails } = await import("@/lib/email/dispatch"));
  ann = await makeUser("r7disp");
  await ann.client.rpc("set_email_preferences", { p_enabled: true, p_locale: "id" });
});
afterAll(async () => {
  await sink.close();
  await cleanup([ann]);
});

describe("dispatchEmails", () => {
  it("sends a queued email through SMTP to the account's address, in the person's language, and marks it sent", async () => {
    await svc.from("notifications").insert({
      user_id: ann.id,
      type: "new_request",
      payload: { title: "Proyek Uji <b>", team: "Tim Biru", request_id: "r1" },
    });
    // Other rows from earlier tests may be waiting too; only this person's mail is checked.
    const result = await dispatchEmails(100);
    expect(result.sent).toBeGreaterThanOrEqual(1);

    const mail = sink.mails.find((m) => m.to.includes(ann.email));
    expect(mail, "a message to the test account").toBeDefined();
    expect(mail!.from).toBe("halo@estafet.test");
    expect(mail!.data).toMatch(/^List-Unsubscribe: <https:\/\/estafet\.test\/akun\/privasi>/im);
    const body = decodeQuotedPrintable(mail!.data);
    expect(body).toContain("Permintaan baru untuk Proyek Uji <b>");
    expect(body).toContain("&lt;b&gt;"); // escaped in the HTML part
    const rows = await outbox(ann.id);
    expect(rows[0]).toMatchObject({ status: "sent", attempts: 1, last_error: null });
  });

  it("does not send the same email twice", async () => {
    const before = sink.mails.filter((m) => m.to.includes(ann.email)).length;
    await dispatchEmails(100);
    expect(sink.mails.filter((m) => m.to.includes(ann.email)).length).toBe(before);
  });

  it("an essential email has no unsubscribe header", async () => {
    await svc.from("notifications").insert({
      user_id: ann.id,
      type: "moderation",
      payload: { title: "Proyek Uji", action: "hide", reason: "Alasan moderasi yang panjang." },
    });
    await dispatchEmails(100);
    const mail = sink.mails.filter((m) => m.to.includes(ann.email)).at(-1)!;
    expect(mail.data).not.toMatch(/List-Unsubscribe/i);
    expect(decodeQuotedPrintable(mail.data)).toContain("disembunyikan");
  });

  it("a provider that is down leaves the email waiting, with a code and no address in the error", async () => {
    const down = await startSmtpSink();
    const port = down.port;
    await down.close();
    process.env.SMTP_PORT = String(port);
    // The transport is cached, so load a fresh copy of the provider for this port.
    const { vi } = await import("vitest");
    vi.resetModules();
    const fresh = await import("@/lib/email/dispatch");

    await svc.from("notifications").insert({
      user_id: ann.id,
      type: "team_invite",
      payload: { title: "Proyek Ketiga" },
    });
    const result = await fresh.dispatchEmails(100);
    expect(result.retry).toBeGreaterThanOrEqual(1);
    const row = (await outbox(ann.id)).find((r) => r.template === "team_invite")!;
    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(1);
    expect(row.last_error).toBeTruthy();
    expect(row.last_error).not.toContain("@");
    expect(new Date(row.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("an account that turned notification emails off gets nothing for ordinary news", async () => {
    await ann.client.rpc("set_email_preferences", { p_enabled: false, p_locale: "id" });
    const before = sink.mails.filter((m) => m.to.includes(ann.email)).length;
    await svc
      .from("notifications")
      .insert({ user_id: ann.id, type: "request_decision", payload: { title: "X", decision: "approved" } });
    process.env.SMTP_PORT = String(sink.port);
    const { vi } = await import("vitest");
    vi.resetModules();
    await (await import("@/lib/email/dispatch")).dispatchEmails(100);
    const decision = (await outbox(ann.id)).find((r) => r.template === "request_decision")!;
    expect(decision.status).toBe("skipped");
    // Nothing new reached the inbox (the earlier invitation is still waiting for its retry time).
    expect(sink.mails.filter((m) => m.to.includes(ann.email)).length).toBe(before);
  });
});
