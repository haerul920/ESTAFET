import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { ANON, URL, cleanup, makeUser, svc, type TestUser } from "./helpers";

/** R9 admin email log: the read-only view, and "send again" for failed essential emails (audited, admins only). */
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const everyone: TestUser[] = [];
let admin: TestUser;
let member: TestUser;
let stamp = 0;

const REASON = "Provider outage is over, sending the notice again.";

beforeAll(async () => {
  [admin, member] = await Promise.all([makeUser("r9admin"), makeUser("r9member")]);
  everyone.push(admin, member);
  const { error } = await svc.rpc("promote_admin", { p_email: admin.email });
  expect(error).toBeNull();
});
afterAll(async () => {
  await cleanup(everyone);
});

/** An outbox row for `member`, written with the service role like the email job does. */
async function outboxRow(row: { template: string; essential: boolean; status: string; attempts?: number }) {
  const { data, error } = await svc
    .from("email_outbox")
    .insert({
      user_id: member.id,
      dedupe_key: `test:r9:${Date.now()}:${stamp++}`,
      template: row.template,
      essential: row.essential,
      status: row.status,
      attempts: row.attempts ?? 5,
      last_error: row.status === "failed" ? "smtp_eauth" : null,
      payload: { title: "Proyek uji" },
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data!.id as string;
}
const auditCount = async (id: string) =>
  (await svc.from("audit_log").select("id").eq("action", "email.resend").eq("target_id", id)).data?.length ?? 0;

describe("admin_email_log_v", () => {
  it("shows outbox metadata to admins, without an address or the message content", async () => {
    const id = await outboxRow({ template: "moderation", essential: true, status: "failed" });
    const { data, error } = await admin.client.from("admin_email_log_v").select("*").eq("id", id).single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ template: "moderation", essential: true, status: "failed", last_error: "smtp_eauth" });
    const text = JSON.stringify(data);
    expect(text).not.toContain(member.email);
    expect(text).not.toContain("Proyek uji");
    expect(Object.keys(data!)).not.toContain("payload");
  });

  it("returns nothing to a signed-in non-admin and is closed to visitors", async () => {
    await outboxRow({ template: "new_request", essential: false, status: "sent", attempts: 1 });
    const mine = await member.client.from("admin_email_log_v").select("id");
    expect(mine.error).toBeNull();
    expect(mine.data).toEqual([]);
    expect((await anon.from("admin_email_log_v").select("id")).error).not.toBeNull();
  });
});

describe("admin_resend_email", () => {
  it("queues a failed essential email again with fresh attempts and writes one audit row", async () => {
    const id = await outboxRow({ template: "moderation", essential: true, status: "failed" });
    const { error } = await admin.client.rpc("admin_resend_email", { p_id: id, p_reason: REASON });
    expect(error).toBeNull();
    const { data: row } = await svc.from("email_outbox").select("status, attempts, last_error").eq("id", id).single();
    expect(row).toEqual({ status: "pending", attempts: 0, last_error: null });
    expect(await auditCount(id)).toBe(1);
  });

  it("refuses a non-essential email, an email that did not fail, and a missing email", async () => {
    const regular = await outboxRow({ template: "new_request", essential: false, status: "failed" });
    const sent = await outboxRow({ template: "moderation", essential: true, status: "sent", attempts: 1 });
    for (const id of [regular, sent]) {
      const r = await admin.client.rpc("admin_resend_email", { p_id: id, p_reason: REASON });
      expect(r.error?.hint).toBe("email_not_resendable");
      expect(await auditCount(id)).toBe(0);
    }
    const missing = await admin.client.rpc("admin_resend_email", {
      p_id: "00000000-0000-4000-8000-00000000e9e9",
      p_reason: REASON,
    });
    expect(missing.error?.hint).toBe("email_not_found");
  });

  it("needs a reason of at least 15 characters", async () => {
    const id = await outboxRow({ template: "access_revoked", essential: true, status: "failed" });
    const r = await admin.client.rpc("admin_resend_email", { p_id: id, p_reason: "too short" });
    expect(r.error).not.toBeNull();
    const { data: row } = await svc.from("email_outbox").select("status").eq("id", id).single();
    expect(row!.status).toBe("failed");
  });

  it("is refused for non-admins and visitors", async () => {
    const id = await outboxRow({ template: "moderation", essential: true, status: "failed" });
    expect((await member.client.rpc("admin_resend_email", { p_id: id, p_reason: REASON })).error).not.toBeNull();
    expect((await anon.rpc("admin_resend_email", { p_id: id, p_reason: REASON })).error).not.toBeNull();
    const { data: row } = await svc.from("email_outbox").select("status").eq("id", id).single();
    expect(row!.status).toBe("failed");
    expect(await auditCount(id)).toBe(0);
  });
});
