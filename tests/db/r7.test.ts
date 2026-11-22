import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANON, URL, cleanup, makeUser, publishedProject, svc, type TestUser } from "./helpers";
import { createClient } from "@supabase/supabase-js";

/** R7 rules: the email outbox (what is queued, preferences, retries) and who may call the sender's functions. */
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const everyone: TestUser[] = [];
let ann: TestUser;
let ben: TestUser;

beforeAll(async () => {
  ann = await makeUser("r7ann");
  ben = await makeUser("r7ben");
  everyone.push(ann, ben);
});
afterAll(async () => {
  await cleanup(everyone);
});

const notify = async (user: TestUser, type: string, payload: Record<string, unknown> = { title: "Proyek uji" }) => {
  const { data, error } = await svc
    .from("notifications")
    .insert({ user_id: user.id, type, payload })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data!.id as string;
};
const outboxFor = async (key: string) =>
  (await svc.from("email_outbox").select("*").eq("dedupe_key", key).maybeSingle()).data;

describe("who can touch the outbox", () => {
  it("visitors and signed-in people cannot call the sender functions or read the table", async () => {
    for (const client of [anon, ann.client]) {
      for (const [fn, args] of [
        ["enqueue_emails", {}],
        ["claim_emails", { p_limit: 5 }],
        ["finish_email", { p_id: "00000000-0000-0000-0000-000000000000", p_ok: true }],
        ["housekeeping", {}],
      ] as const) {
        const { error } = await client.rpc(fn, args);
        expect(error, `${fn} should be refused`).not.toBeNull();
      }
      const read = await client.from("email_outbox").select("id").limit(1);
      expect(read.error !== null || (read.data ?? []).length === 0).toBe(true);
    }
  });
});

describe("enqueue_emails", () => {
  it("queues an email for a listed notification, once, and ignores unlisted types", async () => {
    const id = await notify(ann, "new_request", { title: "Proyek uji", team: "Tim Biru", request_id: "x" });
    const skippedType = await notify(ann, "item_progress");
    expect((await svc.rpc("enqueue_emails")).error).toBeNull();
    const row = await outboxFor(`n:${id}`);
    expect(row).toMatchObject({ user_id: ann.id, template: "new_request", status: "pending", locale: "id" });
    expect(row?.payload).toMatchObject({ team: "Tim Biru" });
    expect(await outboxFor(`n:${skippedType}`)).toBeNull();

    const before = (await svc.from("email_outbox").select("id").eq("user_id", ann.id)).data!.length;
    await svc.rpc("enqueue_emails");
    expect((await svc.from("email_outbox").select("id").eq("user_id", ann.id)).data!.length).toBe(before);
  });

  it("does not store an email address", async () => {
    const id = await notify(ann, "request_decision", { decision: "approved" });
    await svc.rpc("enqueue_emails");
    expect(await outboxFor(`n:${id}`)).not.toBeNull();
    const all = JSON.stringify((await svc.from("email_outbox").select("*").eq("user_id", ann.id)).data);
    expect(all).not.toContain(ann.email);
  });

  it("uses the language on the profile", async () => {
    expect((await ben.client.rpc("set_email_preferences", { p_enabled: true, p_locale: "en" })).error).toBeNull();
    const id = await notify(ben, "agreement_accepted", { title: "T", side: "adopter" });
    await svc.rpc("enqueue_emails");
    expect((await outboxFor(`n:${id}`))?.locale).toBe("en");
  });

  it("respects the preference, except for essential safety emails", async () => {
    expect((await ben.client.rpc("set_email_preferences", { p_enabled: false, p_locale: "en" })).error).toBeNull();
    const normal = await notify(ben, "new_request", { title: "T" });
    const essential = await notify(ben, "moderation", {
      title: "T",
      action: "hide",
      reason: "Alasan yang cukup panjang.",
    });
    const revoked = await notify(ben, "access_revoked", { title: "T" });
    await svc.rpc("enqueue_emails");
    expect((await outboxFor(`n:${normal}`))?.status).toBe("skipped");
    expect((await outboxFor(`n:${essential}`))?.status).toBe("pending");
    expect((await outboxFor(`n:${revoked}`))?.essential).toBe(true);
  });

  it("tells a signed-in reporter how their report ended", async () => {
    const owner = await makeUser("r7owner");
    everyone.push(owner);
    const { projectId } = await publishedProject(owner);
    const { data: report, error } = await svc
      .from("reports")
      .insert({
        project_id: projectId,
        reporter_id: ann.id,
        reason: "spam",
        details: "Isi laporan uji yang cukup panjang.",
        status: "dismissed",
        handled_at: new Date().toISOString(),
      })
      .select("id, reference")
      .single();
    expect(error).toBeNull();
    await svc.rpc("enqueue_emails");
    const row = await outboxFor(`r:${report!.id}:dismissed`);
    expect(row).toMatchObject({ user_id: ann.id, template: "report_outcome", status: "pending" });
    expect(row?.payload).toMatchObject({ reference: report!.reference, outcome: "dismissed" });
  });
});

describe("claim_emails and finish_email", () => {
  const fresh = async () => {
    const id = await notify(ann, "team_invite", { title: "T" });
    await svc.rpc("enqueue_emails");
    // Make it the oldest due row so claim_emails picks it up even if other rows are waiting.
    await svc.from("email_outbox").update({ next_attempt_at: "2000-01-01T00:00:00Z" }).eq("dedupe_key", `n:${id}`);
    return `n:${id}`;
  };

  it("hands a due row out once and marks it sending", async () => {
    const key = await fresh();
    const first = await svc.rpc("claim_emails", { p_limit: 100 });
    expect((first.data as { dedupe_key: string }[]).some((r) => r.dedupe_key === key)).toBe(true);
    const row = await outboxFor(key);
    expect(row).toMatchObject({ status: "sending", attempts: 1 });
    const second = await svc.rpc("claim_emails", { p_limit: 100 });
    expect((second.data as { dedupe_key: string }[]).some((r) => r.dedupe_key === key)).toBe(false);
  });

  it("a success is final", async () => {
    const key = await fresh();
    await svc.rpc("claim_emails", { p_limit: 100 });
    const row = await outboxFor(key);
    expect((await svc.rpc("finish_email", { p_id: row!.id, p_ok: true })).data).toBe("sent");
    expect(await outboxFor(key)).toMatchObject({ status: "sent", last_error: null });
  });

  it("a failure is retried later with a growing delay, and is final after 5 attempts", async () => {
    const key = await fresh();
    let last = "";
    for (let attempt = 1; attempt <= 5; attempt++) {
      await svc.from("email_outbox").update({ next_attempt_at: "2000-01-01T00:00:00Z" }).eq("dedupe_key", key);
      await svc.rpc("claim_emails", { p_limit: 100 });
      const row = await outboxFor(key);
      expect(row?.attempts).toBe(attempt);
      last = (await svc.rpc("finish_email", { p_id: row!.id, p_ok: false, p_error: "ProviderError" })).data as string;
      const after = await outboxFor(key);
      if (attempt < 5) {
        expect(last).toBe("pending");
        expect(new Date(after!.next_attempt_at).getTime()).toBeGreaterThan(Date.now() + 4 * 60 * 1000);
      }
    }
    expect(last).toBe("failed");
    expect(await outboxFor(key)).toMatchObject({ status: "failed", last_error: "ProviderError" });
  });

  it("a row stuck in sending comes back after 10 minutes", async () => {
    const key = await fresh();
    await svc.rpc("claim_emails", { p_limit: 100 });
    await svc
      .from("email_outbox")
      .update({ next_attempt_at: new Date(Date.now() - 11 * 60 * 1000).toISOString() })
      .eq("dedupe_key", key);
    const again = await svc.rpc("claim_emails", { p_limit: 100 });
    expect((again.data as { dedupe_key: string }[]).some((r) => r.dedupe_key === key)).toBe(true);
    expect((await outboxFor(key))?.attempts).toBe(2);
  });
});

describe("preferences and housekeeping", () => {
  it("a person can set their own preference; a visitor cannot; an unknown language is ignored", async () => {
    expect((await anon.rpc("set_email_preferences", { p_enabled: false, p_locale: "id" })).error).not.toBeNull();
    expect((await ann.client.rpc("set_email_preferences", { p_enabled: true, p_locale: "xx" })).error).toBeNull();
    const { data } = await svc.from("profiles").select("email_notifications, locale").eq("id", ann.id).single();
    expect(data).toEqual({ email_notifications: true, locale: "id" });
  });

  it("housekeeping removes old sent mail and keeps recent mail", async () => {
    const oldId = await notify(ann, "ownership_offer", { title: "T" });
    const newId = await notify(ann, "ownership_offer", { title: "T2" });
    await svc.rpc("enqueue_emails");
    await svc
      .from("email_outbox")
      .update({ status: "sent", created_at: new Date(Date.now() - 100 * 86400_000).toISOString() })
      .eq("dedupe_key", `n:${oldId}`);
    await svc.from("email_outbox").update({ status: "sent" }).eq("dedupe_key", `n:${newId}`);
    const { data, error } = await svc.rpc("housekeeping");
    expect(error).toBeNull();
    expect((data as { emails_removed: number }).emails_removed).toBeGreaterThanOrEqual(1);
    expect(await outboxFor(`n:${oldId}`)).toBeNull();
    expect(await outboxFor(`n:${newId}`)).not.toBeNull();
  });
});
