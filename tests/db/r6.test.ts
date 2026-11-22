import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANON, URL, cleanup, makeUser, publishedProject, svc, type TestUser } from "./helpers";
import { createClient } from "@supabase/supabase-js";

/** R6 rules: announcements, bulk dismissal of spam, policy versions with acceptance rates, the fuller overview. */
const REASON = "A written reason that is longer than fifteen characters.";
const run = `${Date.now()}`;
let ipCounter = 0;
const ip = () => `r6ip-${run}-${ipCounter++}`;
const anon = createClient(URL, ANON, { auth: { persistSession: false } });

const everyone: TestUser[] = [];
let admin: TestUser;
let owner: TestUser;
let member: TestUser;
const createdAnnouncements: string[] = [];

beforeAll(async () => {
  admin = await makeUser("r6admin");
  owner = await makeUser("r6owner");
  member = await makeUser("r6member");
  everyone.push(admin, owner, member);
  expect((await svc.rpc("promote_admin", { p_email: admin.email })).error).toBeNull();
});
afterAll(async () => {
  if (createdAnnouncements.length) await svc.from("announcements").delete().in("id", createdAnnouncements);
  await svc.from("profiles").update({ is_admin: false }).eq("id", admin.id);
  await cleanup(everyone);
});

const save = (args: Partial<Record<string, unknown>> = {}) =>
  admin.client.rpc("admin_save_announcement", {
    p_id: null,
    p_severity: "info",
    p_text_id: "Pemeliharaan terjadwal malam ini.",
    p_text_en: "Scheduled maintenance tonight.",
    p_starts: null,
    p_ends: null,
    p_dismissible: true,
    p_reason: REASON,
    ...args,
  });
const auditCount = async (action: string, targetId: string) =>
  (await svc.from("audit_log").select("id").eq("action", action).eq("target_id", targetId)).data?.length ?? 0;

describe("announcements", () => {
  it("an admin publishes one, it is audited, and visitors can read it without any account", async () => {
    const { data: id, error } = await save();
    expect(error).toBeNull();
    createdAnnouncements.push(id as string);
    expect(await auditCount("announcement.create", id as string)).toBe(1);
    const visible = await anon.rpc("active_announcements");
    expect(visible.error).toBeNull();
    const mine = (visible.data as { id: string; text_en: string }[]).find((a) => a.id === id);
    expect(mine?.text_en).toBe("Scheduled maintenance tonight.");
    // The public read carries no author.
    expect(Object.keys(mine!)).not.toContain("created_by");
  });

  it("needs a written reason and a valid time range", async () => {
    expect((await save({ p_reason: "short" })).error).not.toBeNull();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const bad = await save({ p_starts: new Date().toISOString(), p_ends: past });
    expect(bad.error?.hint).toBe("bad_range");
  });

  it("a scheduled announcement is hidden until it starts, and an ended one disappears at once", async () => {
    const future = await save({ p_starts: new Date(Date.now() + 3_600_000).toISOString() });
    createdAnnouncements.push(future.data as string);
    const before = (await anon.rpc("active_announcements")).data as { id: string }[];
    expect(before.some((a) => a.id === future.data)).toBe(false);

    const live = await save({ p_text_en: "Ends right away." });
    createdAnnouncements.push(live.data as string);
    expect(((await anon.rpc("active_announcements")).data as { id: string }[]).some((a) => a.id === live.data)).toBe(
      true,
    );
    expect((await admin.client.rpc("admin_end_announcement", { p_id: live.data, p_reason: REASON })).error).toBeNull();
    expect(((await anon.rpc("active_announcements")).data as { id: string }[]).some((a) => a.id === live.data)).toBe(
      false,
    );
    expect(await auditCount("announcement.end", live.data as string)).toBe(1);
    // It cannot be ended twice.
    expect(
      (await admin.client.rpc("admin_end_announcement", { p_id: live.data, p_reason: REASON })).error,
    ).not.toBeNull();
  });

  it("editing keeps one row and audits the change", async () => {
    const created = await save();
    createdAnnouncements.push(created.data as string);
    const edited = await save({ p_id: created.data, p_severity: "warning", p_text_en: "Edited text." });
    expect(edited.error).toBeNull();
    expect(edited.data).toBe(created.data); // an update returns the same id
    const row = (
      await svc
        .from("announcements")
        .select("severity, text_en")
        .eq("id", created.data as string)
        .single()
    ).data;
    expect(row).toMatchObject({ severity: "warning", text_en: "Edited text." });
    expect(await auditCount("announcement.update", created.data as string)).toBe(1);
  });

  it("a normal user cannot write or read the table, and the admin view is empty for them", async () => {
    const w = await member.client.rpc("admin_save_announcement", {
      p_id: null,
      p_severity: "info",
      p_text_id: "xx x",
      p_text_en: "xx x",
      p_starts: null,
      p_ends: null,
      p_dismissible: true,
      p_reason: REASON,
    });
    expect(w.error).not.toBeNull();
    expect((await member.client.from("announcements").select("id").limit(1)).data ?? []).toEqual([]);
    expect((await member.client.from("admin_announcements_v").select("*").limit(1)).data ?? []).toEqual([]);
  });
});

describe("bulk dismissal of spam reports", () => {
  const file = (projectId: string, reason: string) =>
    svc.rpc("submit_report", {
      p_project: projectId,
      p_reason: reason,
      p_details: "Obvious advertising in the summary text.",
      p_evidence: "",
      p_contact: "",
      p_reporter: null,
      p_ip_hash: ip(),
    });

  it("dismisses only spam reports, audits each one and leaves the project alone", async () => {
    const p = await publishedProject(owner);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await file(p.projectId, "spam");
      expect(r.error).toBeNull();
    }
    const rows = (await svc.from("reports").select("id").eq("project_id", p.projectId)).data as { id: string }[];
    ids.push(...rows.map((r) => r.id));
    expect(ids.length).toBeGreaterThan(0);
    const out = await admin.client.rpc("admin_bulk_dismiss_spam", { p_ids: ids, p_note: REASON });
    expect(out.error).toBeNull();
    expect(out.data).toBe(ids.length);
    for (const id of ids) expect(await auditCount("report.dismiss", id)).toBe(1);
    const after = (await svc.from("reports").select("status").in("id", ids)).data as { status: string }[];
    expect(after.every((r) => r.status === "dismissed")).toBe(true);
    const proj = (await svc.from("projects").select("moderation_status").eq("id", p.projectId).single()).data;
    expect(proj?.moderation_status).toBe("ok");
  });

  it("refuses a report that is not spam, and nothing in the batch changes", async () => {
    const p = await publishedProject(owner);
    await file(p.projectId, "spam");
    await file(p.projectId, "inappropriate");
    const rows = (await svc.from("reports").select("id, reason").eq("project_id", p.projectId)).data as {
      id: string;
      reason: string;
    }[];
    const out = await admin.client.rpc("admin_bulk_dismiss_spam", { p_ids: rows.map((r) => r.id), p_note: REASON });
    expect(out.error?.hint).toBe("not_spam");
    const after = (
      await svc
        .from("reports")
        .select("status")
        .in(
          "id",
          rows.map((r) => r.id),
        )
    ).data as {
      status: string;
    }[];
    expect(after.every((r) => r.status !== "dismissed")).toBe(true);
  });

  it("caps a batch at 50 and needs a reason", async () => {
    const many = Array.from({ length: 51 }, () => crypto.randomUUID());
    expect((await admin.client.rpc("admin_bulk_dismiss_spam", { p_ids: many, p_note: REASON })).error?.hint).toBe(
      "too_many",
    );
    expect((await admin.client.rpc("admin_bulk_dismiss_spam", { p_ids: [], p_note: "no" })).error).not.toBeNull();
  });
});

describe("force sign out", () => {
  it("ends the sessions of another person, audits it, and refuses the admin themselves", async () => {
    const target = await makeUser("r6signout");
    everyone.push(target);
    const before = await svc.from("profiles").select("id").eq("id", target.id).single();
    expect(before.error).toBeNull();
    const out = await admin.client.rpc("admin_force_sign_out", { p_user: target.id, p_reason: REASON });
    expect(out.error).toBeNull();
    expect(typeof out.data).toBe("number");
    expect(await auditCount("user.force_sign_out", target.id)).toBe(1);

    const self = await admin.client.rpc("admin_force_sign_out", { p_user: admin.id, p_reason: REASON });
    expect(self.error?.hint).toBe("self_action");
    expect(
      (await admin.client.rpc("admin_force_sign_out", { p_user: target.id, p_reason: "short" })).error,
    ).not.toBeNull();
    expect(
      (await member.client.rpc("admin_force_sign_out", { p_user: target.id, p_reason: REASON })).error,
    ).not.toBeNull();
  });
});

describe("policy versions", () => {
  it("shows the current version with how many people accepted it", async () => {
    const rows = (await admin.client.from("admin_policies_v").select("*")).data as {
      kind: string;
      version: number;
      accepted: number;
      people: number;
      is_current: boolean;
    }[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const terms = rows.filter((r) => r.kind === "terms" && r.is_current);
    expect(terms).toHaveLength(1);
    expect(terms[0].people).toBeGreaterThan(0);
    expect(terms[0].accepted).toBeLessThanOrEqual(terms[0].people);
  });
});

describe("overview", () => {
  it("returns the queues and key numbers, without the retired advisor counter", async () => {
    const { data, error } = await admin.client.rpc("admin_overview", { p_include_demo: true });
    expect(error).toBeNull();
    const o = data as Record<string, unknown>;
    for (const key of [
      "open_reports",
      "new_reports_24h",
      "held_projects",
      "overdue_holds",
      "open_appeals",
      "failed_runs_24h",
      "stale_requests",
      "projects_by_status",
      "projects_by_moderation",
      "access_by_mode",
      "reports_by_reason",
      "reports_by_outcome",
      "median_days_to_publish",
    ])
      expect(o, key).toHaveProperty(key);
    expect(o).not.toHaveProperty("expired_consents");
  });
});
