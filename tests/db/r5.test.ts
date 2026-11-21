import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, makeUser, publishedProject, svc, type TestUser } from "./helpers";

/** R5 rules: reports, automatic holds, decisions, appeals, reporter anonymity, data export, account deletion, policy versions. */
const REASON = "A written reason that is longer than fifteen characters.";
const hint = (e: { hint?: string | null } | null) => e?.hint ?? null;
const run = `${Date.now()}`;
let ipCounter = 0;
const ip = () => `ip-${run}-${ipCounter++}`;

const everyone: TestUser[] = [];
const mk = async (label: string, opts?: Parameters<typeof makeUser>[1]) => {
  const u = await makeUser(label, opts);
  everyone.push(u);
  return u;
};

let owner: TestUser;
let admin: TestUser;
let alice: TestUser;
let bob: TestUser;
let carol: TestUser;
let outsider: TestUser;

beforeAll(async () => {
  [owner, admin, alice, bob, carol, outsider] = [
    await mk("r5owner"),
    await mk("r5admin"),
    await mk("r5alice"),
    await mk("r5bob"),
    await mk("r5carol"),
    await mk("r5out"),
  ];
  expect((await svc.rpc("promote_admin", { p_email: admin.email })).error).toBeNull();
});
afterAll(async () => {
  await svc.from("profiles").update({ is_admin: false }).eq("id", admin.id);
  await cleanup(everyone);
});

async function report(
  projectId: string,
  reason: string,
  by?: TestUser | null,
  ipHash = ip(),
  extra: Record<string, unknown> = {},
) {
  return svc.rpc("submit_report", {
    p_project: projectId,
    p_reason: reason,
    p_details: "The summary claims more than the files support.",
    p_evidence: "",
    p_contact: "",
    p_reporter: by?.id ?? null,
    p_ip_hash: ipHash,
    ...extra,
  });
}
const status = async (projectId: string) =>
  (await svc.from("projects").select("moderation_status").eq("id", projectId).single()).data!
    .moderation_status as string;
const notes = async (userId: string, type: string) =>
  (await svc.from("notifications").select("payload").eq("user_id", userId).eq("type", type)).data ?? [];

describe("reports", () => {
  it("a guest can report and gets a reference code", async () => {
    const f = await publishedProject(owner);
    const r = await report(f.projectId, "false_information");
    expect(r.error).toBeNull();
    expect(r.data.reference).toMatch(/^LP-[0-9A-F]{8}$/);
    expect(r.data.duplicate).toBe(false);
    const row = (
      await svc.from("reports").select("reporter_id, reporter_key, status").eq("reference", r.data.reference).single()
    ).data!;
    expect(row.reporter_id).toBeNull();
    expect(row.reporter_key).toMatch(/^g:ip-/);
    expect(row.status).toBe("open");
  });

  it("a signed-in reporter sees their own report, and nobody else does", async () => {
    const f = await publishedProject(owner);
    const r = await report(f.projectId, "spam", alice);
    expect(r.error).toBeNull();
    const mine = await alice.client
      .from("my_reports_v")
      .select("reference, status, project_title")
      .eq("reference", r.data.reference);
    expect(mine.data).toHaveLength(1);
    expect(mine.data![0].status).toBe("open");
    expect(
      (await bob.client.from("my_reports_v").select("reference").eq("reference", r.data.reference)).data,
    ).toHaveLength(0);
    expect((await bob.client.from("reports").select("id").eq("reference", r.data.reference)).data).toHaveLength(0);
  });

  it("the same person reporting the same thing again gets the same reference; a different reason is a new report", async () => {
    const f = await publishedProject(owner);
    const a = await report(f.projectId, "inappropriate", alice);
    const b = await report(f.projectId, "inappropriate", alice, ip());
    expect(b.data.duplicate).toBe(true);
    expect(b.data.reference).toBe(a.data.reference);
    const c = await report(f.projectId, "spam", alice);
    expect(c.data.reference).not.toBe(a.data.reference);
    expect((await svc.from("reports").select("id").eq("project_id", f.projectId)).data).toHaveLength(2);
  });

  it("checks the details, the evidence link and the project", async () => {
    const f = await publishedProject(owner);
    expect(hint((await report(f.projectId, "other", null, ip(), { p_details: "short" })).error)).toBe("details_short");
    expect(hint((await report(f.projectId, "other", null, ip(), { p_details: "x".repeat(1001) })).error)).toBe(
      "details_long",
    );
    expect(hint((await report(f.projectId, "other", null, ip(), { p_evidence: "javascript:alert(1)" })).error)).toBe(
      "bad_link",
    );
    expect(
      (await report(f.projectId, "other", null, ip(), { p_evidence: "https://example.org/original-work" })).error,
    ).toBeNull();
    const row = (await svc.from("reports").select("evidence_url").eq("project_id", f.projectId).single()).data!;
    expect(row.evidence_url).toBe("https://example.org/original-work");
    const draft = (
      await owner.client
        .from("projects")
        .insert({
          title: `R5 Draft ${run}${Math.random()}`,
          summary: "x".repeat(40),
          kind: "research",
          field: "Engineering",
          year: 2025,
          stop_reason: "other",
          created_by: owner.id,
        })
        .select("id")
        .single()
    ).data!;
    expect(hint((await report(draft.id, "other")).error)).toBe("not_available");
  });

  it("an owner cannot report their own project, and the report browser function is closed to users", async () => {
    const f = await publishedProject(owner);
    expect(hint((await report(f.projectId, "other", owner)).error)).toBe("own_project");
    const direct = await alice.client.rpc("submit_report", {
      p_project: f.projectId,
      p_reason: "other",
      p_details: "A direct call by a browser.",
      p_evidence: "",
      p_contact: "",
      p_reporter: alice.id,
      p_ip_hash: "x",
    });
    expect(direct.error).not.toBeNull();
  });
});

describe("automatic hold", () => {
  it("holds a project once enough DISTINCT reporters report a serious reason, and tells the owners and the admins neutrally", async () => {
    const f = await publishedProject(owner);
    expect((await report(f.projectId, "copyright", alice)).data.held).toBe(false);
    expect((await report(f.projectId, "copyright", bob)).data.held).toBe(false);
    expect(await status(f.projectId)).toBe("ok");
    const third = await report(f.projectId, "copyright", carol);
    expect(third.data.held).toBe(true);
    expect(await status(f.projectId)).toBe("held");

    // hidden from public lists, with a neutral public check
    expect((await svc.from("public_project_teaser").select("id").eq("id", f.projectId)).data).toHaveLength(0);
    const slug = (await svc.from("projects").select("slug").eq("id", f.projectId).single()).data!.slug;
    expect((await svc.rpc("is_project_held", { p_slug: slug })).data).toBe(true);

    // the decision is recorded as automatic, with a neutral reason that carries no count and no reporter
    const dec =
      (
        await owner.client
          .from("moderation_decisions")
          .select("action, automatic, reason")
          .eq("project_id", f.projectId)
      ).data ?? [];
    expect(dec).toHaveLength(1);
    expect(dec[0]).toMatchObject({ action: "hold", automatic: true });
    expect(dec[0].reason).not.toMatch(/\d|alice|bob|carol|reporter/i);

    // owner notification: reason and decision link, no reporter information
    const n = (await notes(owner.id, "moderation")).filter(
      (x) => (x.payload as { project_id: string }).project_id === f.projectId,
    );
    expect(n).toHaveLength(1);
    expect(Object.keys(n[0].payload as object).sort()).toEqual([
      "action",
      "automatic",
      "decision_id",
      "project_id",
      "reason",
      "slug",
      "title",
    ]);
    expect((n[0].payload as { action: string }).action).toBe("held");

    // admins are alerted
    const alert = (await notes(admin.id, "admin_hold")).filter(
      (x) => (x.payload as { project_id: string }).project_id === f.projectId,
    );
    expect(alert).toHaveLength(1);
  });

  it("one person reporting many times, or many guests behind one address, never reach the threshold", async () => {
    const f = await publishedProject(owner);
    for (let i = 0; i < 6; i++) await report(f.projectId, "copyright", alice); // same account
    for (let i = 0; i < 6; i++) await report(f.projectId, "copyright", null, "shared-office-ip"); // guests behind one address
    // signed-in but unverified accounts count by address, not as separate people
    const ghost1 = await mk("r5ghost1", { verified: false, policies: false });
    const ghost2 = await mk("r5ghost2", { verified: false, policies: false });
    await report(f.projectId, "copyright", ghost1, "shared-office-ip");
    await report(f.projectId, "copyright", ghost2, "shared-office-ip");
    expect(await status(f.projectId)).toBe("ok");
    // distinct people: alice (verified) + the shared address (one) + a second address = 3 -> hold
    expect((await report(f.projectId, "copyright", null, ip())).data.held).toBe(true);
    expect(await status(f.projectId)).toBe("held");
  });

  it("reasons that are not on the serious list never hold a project by count", async () => {
    const f = await publishedProject(owner);
    for (let i = 0; i < 6; i++) await report(f.projectId, "spam", null, ip());
    expect(await status(f.projectId)).toBe("ok");
  });

  it("the threshold is a setting", async () => {
    await svc.from("app_settings").upsert({ key: "report_hold_threshold", value: 2 });
    try {
      const f = await publishedProject(owner);
      await report(f.projectId, "harmful_file", alice);
      expect((await report(f.projectId, "harmful_file", bob)).data.held).toBe(true);
    } finally {
      await svc.from("app_settings").delete().eq("key", "report_hold_threshold");
    }
  });

  it("a hold that nobody reviewed in time alerts the admins once", async () => {
    const f = await publishedProject(owner);
    await report(f.projectId, "personal_data", alice);
    await report(f.projectId, "personal_data", bob);
    await report(f.projectId, "personal_data", carol);
    expect(await status(f.projectId)).toBe("held");
    expect((await svc.rpc("escalate_overdue_holds")).data).toBeGreaterThanOrEqual(0);
    const before = (await notes(admin.id, "admin_hold_overdue")).filter(
      (x) => (x.payload as { project_id: string }).project_id === f.projectId,
    );
    expect(before).toHaveLength(0); // fresh hold: not overdue yet
    await svc
      .from("projects")
      .update({ moderated_at: new Date(Date.now() - 4 * 864e5).toISOString() })
      .eq("id", f.projectId);
    await svc.rpc("escalate_overdue_holds");
    await svc.rpc("escalate_overdue_holds");
    const after = (await notes(admin.id, "admin_hold_overdue")).filter(
      (x) => (x.payload as { project_id: string }).project_id === f.projectId,
    );
    expect(after).toHaveLength(1);
    expect((await owner.client.rpc("escalate_overdue_holds")).error).not.toBeNull();
  });
});

describe("owners never see reporters", () => {
  it("owners cannot read reports, and decisions, notifications and the project row carry no reporter", async () => {
    const f = await publishedProject(owner);
    await report(f.projectId, "inappropriate", alice, ip(), { p_contact: "alice@example.test" });
    expect((await owner.client.from("reports").select("id").eq("project_id", f.projectId)).data).toHaveLength(0);
    expect((await owner.client.from("admin_reports_v").select("id")).data ?? []).toHaveLength(0);
    const rid = (await svc.from("reports").select("id").eq("project_id", f.projectId).single()).data!.id;
    expect(
      (await admin.client.rpc("admin_handle_report", { p_report: rid, p_action: "hide", p_note: REASON })).error,
    ).toBeNull();
    const dec = (await owner.client.from("moderation_decisions").select("*").eq("project_id", f.projectId)).data!;
    expect(JSON.stringify(dec)).not.toMatch(/alice|reporter_key|reporter_id|report_id/i);
    expect(Object.keys(dec[0])).not.toEqual(expect.arrayContaining(["report_id"]));
  });
});

describe("decisions, appeals and restore", () => {
  it("dismiss, hide with a reason, owner notified, appeal, reject, appeal again is refused, a new decision can be appealed and accepted", async () => {
    const f = await publishedProject(owner);
    const r = await report(f.projectId, "false_ownership", alice);
    const rid = (await svc.from("reports").select("id").eq("reference", r.data.reference).single()).data!.id;

    // every decision needs a written reason
    expect(
      hint((await admin.client.rpc("admin_handle_report", { p_report: rid, p_action: "hide", p_note: "short" })).error),
    ).toBe("reason_short");
    // a non-admin cannot decide
    expect(
      (await owner.client.rpc("admin_handle_report", { p_report: rid, p_action: "dismiss", p_note: REASON })).error,
    ).not.toBeNull();

    // hide with a reason: the project leaves the public pages, the owner is told the reason
    expect(
      (await admin.client.rpc("admin_handle_report", { p_report: rid, p_action: "hide", p_note: REASON })).error,
    ).toBeNull();
    expect(await status(f.projectId)).toBe("hidden");
    expect((await svc.from("public_project_teaser").select("id").eq("id", f.projectId)).data).toHaveLength(0);
    const n = (await notes(owner.id, "moderation")).filter(
      (x) => (x.payload as { project_id: string }).project_id === f.projectId,
    );
    expect(n).toHaveLength(1);
    expect(n[0].payload).toMatchObject({ action: "hidden", reason: REASON, automatic: false });
    const decisionId = (n[0].payload as { decision_id: string }).decision_id;

    // appeal: outsiders cannot, too-short appeals are refused, the owner can, only once per decision
    expect(
      hint((await outsider.client.rpc("appeal_decision", { p_decision: decisionId, p_body: "x".repeat(40) })).error),
    ).toBe("not_owner");
    expect(
      hint((await owner.client.rpc("appeal_decision", { p_decision: decisionId, p_body: "too short" })).error),
    ).toBe("appeal_short");
    const ap = await owner.client.rpc("appeal_decision", {
      p_decision: decisionId,
      p_body: "The files are ours and the quoted text is from our own report.",
    });
    expect(ap.error).toBeNull();
    expect(
      hint(
        (
          await owner.client.rpc("appeal_decision", {
            p_decision: decisionId,
            p_body: "Trying to appeal the same decision a second time.",
          })
        ).error,
      ),
    ).toBe("appeal_exists");
    expect((await notes(admin.id, "admin_appeal")).length).toBeGreaterThan(0);

    // the admin queue shows it; only admins resolve it, with a reason
    expect(
      (await admin.client.from("admin_appeals_v").select("status, decision_action").eq("id", ap.data)).data?.[0],
    ).toMatchObject({ status: "open", decision_action: "hide" });
    expect(
      (await owner.client.rpc("admin_resolve_appeal", { p_appeal: ap.data, p_outcome: "accepted", p_note: REASON }))
        .error,
    ).not.toBeNull();
    expect(
      hint(
        (await admin.client.rpc("admin_resolve_appeal", { p_appeal: ap.data, p_outcome: "rejected", p_note: "no" }))
          .error,
      ),
    ).toBe("reason_short");
    expect(
      (
        await admin.client.rpc("admin_resolve_appeal", {
          p_appeal: ap.data,
          p_outcome: "rejected",
          p_note: "The ownership evidence is not convincing yet.",
        })
      ).error,
    ).toBeNull();
    expect(await status(f.projectId)).toBe("hidden");
    const out = (await notes(owner.id, "appeal_outcome")).filter(
      (x) => (x.payload as { project_id: string }).project_id === f.projectId,
    );
    expect(out).toHaveLength(1);
    expect(out[0].payload).toMatchObject({ outcome: "rejected" });
    // a decided appeal cannot be decided again
    expect(
      (await admin.client.rpc("admin_resolve_appeal", { p_appeal: ap.data, p_outcome: "accepted", p_note: REASON }))
        .error,
    ).not.toBeNull();

    // the admin removes the project: that is a NEW decision, and it can be appealed
    expect(
      (
        await admin.client.rpc("admin_set_project_moderation", {
          p_project: f.projectId,
          p_status: "removed",
          p_reason: REASON,
        })
      ).error,
    ).toBeNull();
    const dec2 = (
      await owner.client
        .from("moderation_decisions")
        .select("id, action")
        .eq("project_id", f.projectId)
        .eq("action", "remove")
    ).data!;
    // the old decision is outdated now: a newer decision replaced it
    expect(
      hint(
        (
          await owner.client.rpc("appeal_decision", {
            p_decision: decisionId,
            p_body: "Appealing the older decision again after a newer one.",
          })
        ).error,
      ),
    ).toBe("decision_outdated");
    const ap2 = await owner.client.rpc("appeal_decision", {
      p_decision: dec2[0].id,
      p_body: "We can show the original files and the commit history to prove ownership.",
    });
    expect(ap2.error).toBeNull();

    // accepting restores the project and records a restore decision
    expect(
      (
        await admin.client.rpc("admin_resolve_appeal", {
          p_appeal: ap2.data,
          p_outcome: "accepted",
          p_note: "Ownership was shown with the original files.",
        })
      ).error,
    ).toBeNull();
    expect(await status(f.projectId)).toBe("ok");
    expect((await svc.from("public_project_teaser").select("id").eq("id", f.projectId)).data).toHaveLength(1);
    const actions = (
      (await owner.client.from("moderation_decisions").select("action").eq("project_id", f.projectId)).data ?? []
    ).map((d) => d.action);
    expect(actions).toEqual(expect.arrayContaining(["hide", "remove", "restore"]));
    expect(
      (await notes(owner.id, "appeal_outcome")).filter((x) => (x.payload as { outcome: string }).outcome === "accepted")
        .length,
    ).toBeGreaterThan(0);
  });

  it("dismissing a report is recorded with its reason, but the owner is not notified and cannot see it", async () => {
    const f = await publishedProject(owner);
    const r = await report(f.projectId, "other", alice);
    const rid = (await svc.from("reports").select("id").eq("reference", r.data.reference).single()).data!.id;
    expect(
      (
        await admin.client.rpc("admin_handle_report", {
          p_report: rid,
          p_action: "dismiss",
          p_note: "The report describes a disagreement, not a violation.",
        })
      ).error,
    ).toBeNull();
    expect(
      (await svc.from("moderation_decisions").select("action, reason").eq("project_id", f.projectId)).data,
    ).toMatchObject([{ action: "dismiss" }]);
    expect(
      (await owner.client.from("moderation_decisions").select("id").eq("project_id", f.projectId)).data,
    ).toHaveLength(0);
    expect(
      (await notes(owner.id, "moderation")).filter(
        (x) => (x.payload as { project_id: string }).project_id === f.projectId,
      ),
    ).toHaveLength(0);
    expect((await svc.from("reports").select("status").eq("id", rid).single()).data!.status).toBe("dismissed");
  });

  it("an admin can restore a held project, and a restore with no reason is refused", async () => {
    const f = await publishedProject(owner);
    await report(f.projectId, "copyright", alice);
    await report(f.projectId, "copyright", bob);
    await report(f.projectId, "copyright", carol);
    expect(await status(f.projectId)).toBe("held");
    expect(
      hint(
        (
          await admin.client.rpc("admin_set_project_moderation", {
            p_project: f.projectId,
            p_status: "ok",
            p_reason: "",
          })
        ).error,
      ),
    ).toBe("reason_short");
    expect(
      (
        await admin.client.rpc("admin_set_project_moderation", {
          p_project: f.projectId,
          p_status: "ok",
          p_reason: "Reviewed: the work is the team's own.",
        })
      ).error,
    ).toBeNull();
    expect(await status(f.projectId)).toBe("ok");
    const n = (await notes(owner.id, "moderation")).filter(
      (x) => (x.payload as { project_id: string; action: string }).project_id === f.projectId,
    );
    expect(n.map((x) => (x.payload as { action: string }).action).sort()).toEqual(["held", "restored"]);
  });
});

describe("data export", () => {
  it("contains my own data and nobody else's", async () => {
    const f = await publishedProject(owner);
    await report(f.projectId, "spam", alice, ip(), { p_details: "Alice's private report text, not for anyone else." });
    await svc.from("project_watchers").insert({ project_id: f.projectId, profile_id: alice.id });
    const mine = (await alice.client.rpc("export_my_data")).data;
    expect(mine.account.email).toBe(alice.email);
    expect(mine.reports_filed.some((r: { details: string }) => r.details.startsWith("Alice's private report"))).toBe(
      true,
    );
    expect(mine.watching.length).toBeGreaterThan(0);
    expect(mine.policy_acceptances.length).toBeGreaterThan(0);
    expect(Object.keys(mine).sort()).toEqual(
      [
        "access",
        "account",
        "agreements",
        "appeals",
        "deletion",
        "exported_at",
        "files",
        "items",
        "note",
        "notifications",
        "policy_acceptances",
        "profile",
        "projects",
        "reports_filed",
        "requests_sent",
        "watching",
      ].sort(),
    );
    // the owner's export has the project, and does not contain Alice's report or her email
    const theirs = (await owner.client.rpc("export_my_data")).data;
    expect(theirs.projects.some((p: { id: string }) => p.id === f.projectId)).toBe(true);
    expect(JSON.stringify(theirs)).not.toMatch(/Alice's private report|alice/i);
    // guests cannot export
    const { createClient } = await import("@supabase/supabase-js");
    const guest = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    expect((await guest.rpc("export_my_data")).error).not.toBeNull();
  });
});

describe("account deletion with a 30 day grace period", () => {
  it("is requested, cancellable, keeps one date, and is not done early", async () => {
    const u = await mk("r5del1");
    const when = (await u.client.rpc("request_account_deletion")).data as string;
    const days = (new Date(when).getTime() - Date.now()) / 864e5;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect((await u.client.rpc("request_account_deletion")).data).toBe(when); // asking again keeps the date
    expect((await svc.rpc("anonymize_deleted_account", { p_profile: u.id })).error?.hint).toBe("not_due");
    expect((await u.client.rpc("cancel_account_deletion")).error).toBeNull();
    const row = (await u.client.from("account_deletions").select("cancelled_at, completed_at").single()).data!;
    expect(row.cancelled_at).not.toBeNull();
    expect((await svc.rpc("due_account_deletions")).data).not.toContainEqual({ profile_id: u.id });
    // a new request after cancelling starts a new grace period
    const again = (await u.client.rpc("request_account_deletion")).data as string;
    expect(new Date(again).getTime()).toBeGreaterThan(Date.now() + 29 * 864e5);
  });

  it("after the grace period: personal data goes, requests end, access ends, sole drafts are listed, published projects keep their attribution", async () => {
    const leaver = await mk("r5leaver");
    const other = await mk("r5other");
    // a published project of the leaver (stays), a draft of the leaver (listed), a project of someone else that the leaver continues
    const kept = await publishedProject(leaver);
    const draft = (
      await leaver.client
        .from("projects")
        .insert({
          title: `R5 Leaver Draft ${run}`,
          summary: "x".repeat(40),
          kind: "research",
          field: "Engineering",
          year: 2025,
          stop_reason: "other",
          created_by: leaver.id,
        })
        .select("id")
        .single()
    ).data!;
    const theirs = await publishedProject(other, { mode: "open", max: 3 });
    expect(
      (await leaver.client.rpc("take_access", { p_project_id: theirs.projectId, p_agreement_version: 1 })).error,
    ).toBeNull();
    await svc.from("project_watchers").insert({ project_id: theirs.projectId, profile_id: leaver.id });
    const rep = await report(theirs.projectId, "spam", leaver);

    await leaver.client.rpc("request_account_deletion");
    await svc
      .from("account_deletions")
      .update({ scheduled_for: new Date(Date.now() - 1000).toISOString() })
      .eq("profile_id", leaver.id);
    expect(
      ((await svc.rpc("due_account_deletions")).data ?? []).map((r: { profile_id: string }) => r.profile_id),
    ).toContain(leaver.id);

    const done = await svc.rpc("anonymize_deleted_account", { p_profile: leaver.id });
    expect(done.error).toBeNull();
    expect(done.data.draft_projects).toEqual([draft.id]);

    const profile = (
      await svc.from("profiles").select("full_name, university, faculty, avatar_url").eq("id", leaver.id).single()
    ).data!;
    expect(profile.full_name).toBe("Pengguna lama");
    expect(profile.university).toBe("");
    expect(
      (await svc.from("project_access").select("status").eq("profile_id", leaver.id)).data?.every(
        (a) => a.status === "revoked",
      ),
    ).toBe(true);
    expect((await svc.from("project_watchers").select("project_id").eq("profile_id", leaver.id)).data).toHaveLength(0);
    expect((await svc.from("notifications").select("id").eq("user_id", leaver.id)).data).toHaveLength(0);
    expect(
      (await svc.from("reports").select("reporter_id").eq("reference", rep.data.reference).single()).data!.reporter_id,
    ).toBeNull();
    // the published project stays, its lineage stays, and the owner row stays (shown as "Pengguna lama")
    expect((await svc.from("projects").select("status").eq("id", kept.projectId).single()).data!.status).toBe(
      "published",
    );
    expect(
      (await svc.from("lineage_events").select("id").eq("project_id", kept.projectId)).data!.length,
    ).toBeGreaterThan(0);
    expect(
      (await svc.from("account_deletions").select("completed_at").eq("profile_id", leaver.id).single()).data!
        .completed_at,
    ).not.toBeNull();
    // it cannot be run twice
    expect((await svc.rpc("anonymize_deleted_account", { p_profile: leaver.id })).error?.hint).toBe("not_due");
    // and it is closed to browsers
    expect((await other.client.rpc("anonymize_deleted_account", { p_profile: leaver.id })).error).not.toBeNull();
  });
});

describe("policy versions", () => {
  it("publishing a new version means everybody must accept it again", async () => {
    const u = await mk("r5policy");
    expect((await svc.rpc("has_current_policies", { uid: u.id })).data).toBe(true);
    expect(
      hint((await u.client.rpc("admin_publish_policy", { p_kind: "terms", p_version: 2, p_reason: REASON })).error),
    ).not.toBe("version_not_higher");
    try {
      // not an admin: refused
      expect(
        (await u.client.rpc("admin_publish_policy", { p_kind: "terms", p_version: 2, p_reason: REASON })).error,
      ).not.toBeNull();
      expect(
        hint(
          (await admin.client.rpc("admin_publish_policy", { p_kind: "terms", p_version: 1, p_reason: REASON })).error,
        ),
      ).toBe("version_not_higher");
      expect(
        (await admin.client.rpc("admin_publish_policy", { p_kind: "terms", p_version: 2, p_reason: REASON })).error,
      ).toBeNull();
      expect((await svc.rpc("has_current_policies", { uid: u.id })).data).toBe(false);
      expect((await u.client.rpc("accept_current_policies")).error).toBeNull();
      expect((await svc.rpc("has_current_policies", { uid: u.id })).data).toBe(true);
    } finally {
      // keep the shared database usable for the other tests and the demo accounts
      await svc.from("policy_acceptances").delete().eq("kind", "terms").eq("version", 2);
      await svc.from("policies").delete().eq("kind", "terms").eq("version", 2);
    }
  });
});
