import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ANON,
  URL,
  cleanup,
  makeUser,
  publishedProject,
  requestArgs,
  svc,
  type Fixture,
  type TestUser,
} from "./helpers";

const REASON = "Revoked because the agreed scope changed.";
const hint = (e: { hint?: string | null } | null) => e?.hint ?? null;
const files = async (u: TestUser, projectId: string) =>
  (await u.client.from("project_files").select("id").eq("project_id", projectId)).data ?? [];
const lineage = async (projectId: string) =>
  ((await svc.from("lineage_events").select("type").eq("project_id", projectId)).data ?? []).map(
    (e) => e.type as string,
  );
const accessRows = async (projectId: string, status = "active") =>
  (
    await svc
      .from("project_access")
      .select("id, profile_id, request_id, status")
      .eq("project_id", projectId)
      .eq("status", status)
  ).data ?? [];

let owner: TestUser;
let other: TestUser;
const everyone: TestUser[] = [];
const mk = async (label: string, opts?: Parameters<typeof makeUser>[1]) => {
  const u = await makeUser(label, opts);
  everyone.push(u);
  return u;
};

beforeAll(async () => {
  owner = await mk("owner");
  other = await mk("other");
});
afterAll(() => cleanup(everyone));

describe("one account type", () => {
  it("profiles has no role column", async () => {
    const { data } = await svc.from("profiles").select("*").eq("id", owner.id).single();
    expect(Object.keys(data!)).not.toEqual(expect.arrayContaining(["role"]));
  });

  it("the same account shares one project and continues another", async () => {
    const a = await publishedProject(owner, { mode: "open" });
    const b = await publishedProject(other, { mode: "open" });
    const take = await owner.client.rpc("take_access", { p_project_id: b.projectId, p_agreement_version: 1 });
    expect(take.error).toBeNull();
    // owner of A holds access to B, and still owns A
    expect(await files(owner, b.projectId)).toHaveLength(1);
    expect(await files(owner, a.projectId)).toHaveLength(1);
    expect((await owner.client.rpc("is_project_owner", { pid: a.projectId })).data).toBe(true);
    expect((await owner.client.rpc("is_project_owner", { pid: b.projectId })).data).toBe(false);
    expect((await owner.client.rpc("has_access", { pid: b.projectId })).data).toBe(true);
  });
});

describe("verification and policies", () => {
  it("an unverified account cannot share, take access or request", async () => {
    const ghost = await mk("ghost", { verified: false });
    const open = await publishedProject(owner, { mode: "open" });
    const byReq = await publishedProject(owner, { mode: "by_request" });
    const insert = await ghost.client.from("projects").insert({
      title: `Ghost ${Date.now()}${Math.floor(Math.random() * 1000)}`,
      summary: "x".repeat(40),
      created_by: ghost.id,
    });
    expect(insert.error).not.toBeNull();
    expect(
      hint((await ghost.client.rpc("take_access", { p_project_id: open.projectId, p_agreement_version: 1 })).error),
    ).toBe("email_unverified");
    expect(
      hint((await ghost.client.rpc("create_continuation_request", requestArgs(byReq.projectId, byReq.taskId))).error),
    ).toBe("email_unverified");
  });

  it("publishing needs the current policies to be accepted", async () => {
    const fresh = await mk("nopolicy", { policies: false });
    const { data } = await fresh.client
      .from("projects")
      .insert({
        title: `Policy gate ${Date.now()}${Math.floor(Math.random() * 1000)}`,
        summary: "x".repeat(40),
        created_by: fresh.id,
      })
      .select("id")
      .single();
    const pid = data!.id as string;
    await svc.from("draft_items").insert({ project_id: pid, kind: "lesson", title: "L", review_status: "kept" });
    await fresh.client.rpc("confirm_team_consent", { p_project_id: pid });
    expect((await fresh.client.rpc("i_accepted_current_policies")).data).toBe(false);
    expect(hint((await fresh.client.rpc("publish_project", { p_project_id: pid })).error)).toBe("policies_required");
    expect((await fresh.client.rpc("accept_current_policies")).error).toBeNull();
    expect((await fresh.client.rpc("i_accepted_current_policies")).data).toBe(true);
    expect((await fresh.client.rpc("publish_project", { p_project_id: pid })).error).toBeNull();
  });

  it("a policy version that is not yet effective does not change what is current", async () => {
    const before = (await owner.client.rpc("current_policy_version", { p_kind: "terms" })).data;
    await svc
      .from("policies")
      .insert({ kind: "terms", version: 99, effective_at: new Date(Date.now() + 864e5).toISOString() });
    try {
      expect((await owner.client.rpc("current_policy_version", { p_kind: "terms" })).data).toBe(before);
      expect((await owner.client.rpc("i_accepted_current_policies")).data).toBe(true);
    } finally {
      await svc.from("policies").delete().eq("version", 99);
    }
  });
});

describe("lifecycle: draft, published, unpublished, archived", () => {
  let fx: Fixture;
  let visitor: TestUser;
  beforeAll(async () => {
    visitor = await mk("visitor");
    fx = await publishedProject(owner, { mode: "open" });
  });
  const visible = async () =>
    (
      await createClient(URL, ANON, { auth: { persistSession: false } })
        .from("public_project_teaser")
        .select("id")
        .eq("id", fx.projectId)
    ).data ?? [];

  it("a published project is public, an unpublished one is not", async () => {
    expect(await visible()).toHaveLength(1);
    expect((await visitor.client.rpc("unpublish_project", { p_project_id: fx.projectId })).error?.message).toMatch(
      /Only an owner/,
    );
    expect((await owner.client.rpc("unpublish_project", { p_project_id: fx.projectId })).error).toBeNull();
    expect(await visible()).toHaveLength(0);
    expect(
      hint((await visitor.client.rpc("take_access", { p_project_id: fx.projectId, p_agreement_version: 1 })).error),
    ).toBe("not_available");
  });

  it("existing access survives unpublishing, and the owner can republish", async () => {
    // give visitor access while published, then unpublish
    expect((await owner.client.rpc("publish_project", { p_project_id: fx.projectId })).error).toBeNull();
    expect(
      (await visitor.client.rpc("take_access", { p_project_id: fx.projectId, p_agreement_version: 1 })).error,
    ).toBeNull();
    expect((await owner.client.rpc("unpublish_project", { p_project_id: fx.projectId })).error).toBeNull();
    expect(await files(visitor, fx.projectId)).toHaveLength(1);
    expect((await owner.client.rpc("publish_project", { p_project_id: fx.projectId })).error).toBeNull();
    expect(await visible()).toHaveLength(1);
    expect(await lineage(fx.projectId)).toEqual(expect.arrayContaining(["unpublished", "republished"]));
  });

  it("an archived project is read-only, cannot be published again, and keeps active access", async () => {
    expect((await owner.client.rpc("archive_project", { p_project_id: fx.projectId })).error).toBeNull();
    expect(await visible()).toHaveLength(0);
    expect(hint((await owner.client.rpc("publish_project", { p_project_id: fx.projectId })).error)).toBe("archived");
    expect(
      hint(
        (await owner.client.rpc("set_access_settings", { p_project_id: fx.projectId, p_mode: "open", p_max: 3 })).error,
      ),
    ).toBe("archived");
    expect(
      (await owner.client.from("projects").update({ title: "New title" }).eq("id", fx.projectId).select("id")).data,
    ).toEqual([]);
    expect(await files(visitor, fx.projectId)).toHaveLength(1);
  });

  it("a status cannot be written directly", async () => {
    const f2 = await publishedProject(owner);
    const r = await owner.client.from("projects").update({ status: "archived" }).eq("id", f2.projectId);
    expect(r.error).not.toBeNull();
    const m = await owner.client.from("projects").update({ access_mode: "open" }).eq("id", f2.projectId);
    expect(m.error).not.toBeNull();
  });
});

describe("co-owners", () => {
  it("an invitation is not membership until the invitee accepts; consent is per active member", async () => {
    const co = await mk("coowner");
    const { data } = await owner.client
      .from("projects")
      .insert({
        title: `Team ${Date.now()}${Math.floor(Math.random() * 1000)}`,
        summary: "x".repeat(40),
        created_by: owner.id,
      })
      .select("id")
      .single();
    const pid = data!.id as string;
    expect(
      (await other.client.rpc("invite_co_owner", { p_project_id: pid, p_email: co.email })).error?.message,
    ).toMatch(/Only an owner/);
    expect((await owner.client.rpc("invite_co_owner", { p_project_id: pid, p_email: co.email })).error).toBeNull();
    expect((await co.client.rpc("is_project_owner", { pid })).data).toBe(false);
    expect((await co.client.from("projects").select("id").eq("id", pid)).data).toEqual([]);
    expect((await co.client.rpc("respond_co_owner_invite", { p_project_id: pid, p_accept: true })).error).toBeNull();
    expect((await co.client.rpc("is_project_owner", { pid })).data).toBe(true);
    const { data: p } = await svc.from("projects").select("team_size").eq("id", pid).single();
    expect(p!.team_size).toBe(2);
    expect(hint((await owner.client.rpc("respond_co_owner_invite", { p_project_id: pid, p_accept: true })).error)).toBe(
      "no_invitation",
    );

    // the co-owner has not consented, so publishing is blocked even though the owner has
    await svc.from("draft_items").insert({ project_id: pid, kind: "lesson", title: "L", review_status: "kept" });
    await owner.client.rpc("confirm_team_consent", { p_project_id: pid });
    expect(hint((await owner.client.rpc("publish_project", { p_project_id: pid })).error)).toBe("team_consent");
    await co.client.rpc("confirm_team_consent", { p_project_id: pid });
    expect((await owner.client.rpc("publish_project", { p_project_id: pid })).error).toBeNull();

    // the primary owner cannot be removed, a co-owner can
    expect(hint((await co.client.rpc("remove_team_member", { p_project_id: pid, p_profile: owner.id })).error)).toBe(
      "owner_protected",
    );
  });

  it("declining an invitation leaves the invitee out", async () => {
    const co = await mk("decliner");
    const { data } = await owner.client
      .from("projects")
      .insert({
        title: `Team 2 ${Date.now()}${Math.floor(Math.random() * 1000)}`,
        summary: "x".repeat(40),
        created_by: owner.id,
      })
      .select("id")
      .single();
    const pid = data!.id as string;
    await owner.client.rpc("invite_co_owner", { p_project_id: pid, p_email: co.email });
    expect((await co.client.rpc("respond_co_owner_invite", { p_project_id: pid, p_accept: false })).error).toBeNull();
    expect((await co.client.rpc("is_project_owner", { pid })).data).toBe(false);
  });
});

describe("access, open mode", () => {
  let fx: Fixture;
  beforeAll(async () => {
    fx = await publishedProject(owner, { mode: "open", max: 1 });
  });

  it("owners cannot take access to their own project", async () => {
    expect(
      hint((await owner.client.rpc("take_access", { p_project_id: fx.projectId, p_agreement_version: 1 })).error),
    ).toBe("own_project");
  });

  it("files stay private until access is taken, then unlock without approval", async () => {
    const u = await mk("opener");
    expect(await files(u, fx.projectId)).toEqual([]);
    expect(
      hint((await u.client.rpc("take_access", { p_project_id: fx.projectId, p_agreement_version: 99 })).error),
    ).toBe("agreement_version");
    expect(await files(u, fx.projectId)).toEqual([]);
    expect(
      (await u.client.rpc("take_access", { p_project_id: fx.projectId, p_agreement_version: 1 })).error,
    ).toBeNull();
    expect(await files(u, fx.projectId)).toHaveLength(1);
    expect(await lineage(fx.projectId)).toEqual(
      expect.arrayContaining(["agreement_signed", "access_taken", "continued"]),
    );
    const note = await svc.from("notifications").select("payload").eq("user_id", owner.id).eq("type", "access_taken");
    expect((note.data ?? []).some((n) => (n.payload as { project_id: string }).project_id === fx.projectId)).toBe(true);
    expect(
      hint((await u.client.rpc("take_access", { p_project_id: fx.projectId, p_agreement_version: 1 })).error),
    ).toBe("already_has_access");
  });

  it("a full quota blocks the next person, and the CTA data says so", async () => {
    const late = await mk("late");
    expect(
      hint((await late.client.rpc("take_access", { p_project_id: fx.projectId, p_agreement_version: 1 })).error),
    ).toBe("quota_full");
    const { data } = await createClient(URL, ANON, { auth: { persistSession: false } })
      .from("public_project_teaser")
      .select("access_mode, max_active_adopters, active_adopters")
      .eq("id", fx.projectId)
      .single();
    expect(data).toMatchObject({ access_mode: "open", max_active_adopters: 1, active_adopters: 1 });
  });

  it("raising the limit lets the next person in; unlimited has no cap", async () => {
    expect(
      (await owner.client.rpc("set_access_settings", { p_project_id: fx.projectId, p_mode: "open", p_max: null }))
        .error,
    ).toBeNull();
    const people = await Promise.all([mk("a1"), mk("a2"), mk("a3"), mk("a4")]);
    for (const p of people)
      expect(
        (await p.client.rpc("take_access", { p_project_id: fx.projectId, p_agreement_version: 1 })).error,
      ).toBeNull();
    expect(await accessRows(fx.projectId)).toHaveLength(5);
    expect(
      (await owner.client.rpc("set_access_settings", { p_project_id: fx.projectId, p_mode: "open", p_max: 2 })).error
        ?.hint,
    ).toBe("bad_limit");
    expect(await lineage(fx.projectId)).toContain("access_settings_changed");
  });

  it("the retired paused mode cannot be chosen any more", async () => {
    const fx2 = await publishedProject(owner, { mode: "open" });
    expect(
      (await owner.client.rpc("set_access_settings", { p_project_id: fx2.projectId, p_mode: "paused", p_max: 3 }))
        .error,
    ).not.toBeNull();
    const now = await owner.client.from("projects").select("access_mode").eq("id", fx2.projectId).single();
    expect(now.data?.access_mode).toBe("open");
  });

  it("accepts a request that picks no suggestion: the team may follow its own plan", async () => {
    const f = await publishedProject(owner, { mode: "by_request" });
    const u = await mk("own-plan");
    const r = await u.client.rpc("create_continuation_request", requestArgs(f.projectId, f.taskId, { p_task_ids: [] }));
    expect(r.error).toBeNull();
  });

  it("by_request mode refuses direct access, open mode refuses requests", async () => {
    const byReq = await publishedProject(owner, { mode: "by_request" });
    const open = await publishedProject(owner, { mode: "open" });
    const u = await mk("mode");
    expect(
      hint((await u.client.rpc("take_access", { p_project_id: byReq.projectId, p_agreement_version: 1 })).error),
    ).toBe("needs_request");
    expect(
      hint((await u.client.rpc("create_continuation_request", requestArgs(open.projectId, open.taskId))).error),
    ).toBe("open_mode");
  });

  it("holders see only kept items; owners see all", async () => {
    const fx3 = await publishedProject(owner, { mode: "open" });
    await svc
      .from("draft_items")
      .insert({ project_id: fx3.projectId, kind: "next_task", title: "Removed one", review_status: "removed" });
    const u = await mk("reader");
    await u.client.rpc("take_access", { p_project_id: fx3.projectId, p_agreement_version: 1 });
    const mine =
      (await u.client.from("draft_items").select("title, review_status").eq("project_id", fx3.projectId)).data ?? [];
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((i) => i.review_status === "kept")).toBe(true);
    const theirs = (await owner.client.from("draft_items").select("id").eq("project_id", fx3.projectId)).data ?? [];
    expect(theirs).toHaveLength(2);
  });
});

describe("access, by request", () => {
  let fx: Fixture;
  let team: TestUser;
  let mate: TestUser;
  beforeAll(async () => {
    fx = await publishedProject(owner, { mode: "by_request", max: 3 });
    team = await mk("team");
    mate = await mk("mate");
  });

  it("a chosen suggestion must belong to the project, and owners cannot request their own", async () => {
    expect(
      hint(
        (
          await team.client.rpc(
            "create_continuation_request",
            requestArgs(fx.projectId, fx.taskId, { p_task_ids: ["00000000-0000-4000-8000-000000000000"] }),
          )
        ).error,
      ),
    ).toBe("no_task");
    expect(
      hint((await owner.client.rpc("create_continuation_request", requestArgs(fx.projectId, fx.taskId))).error),
    ).toBe("own_project");
  });

  let requestId: string;
  it("creates one open request per account, with an expiry", async () => {
    const r = await team.client.rpc(
      "create_continuation_request",
      requestArgs(fx.projectId, fx.taskId, { p_members: [{ email: mate.email }] }),
    );
    expect(r.error).toBeNull();
    requestId = r.data as string;
    const { data } = await svc.from("continuation_requests").select("expires_at, status").eq("id", requestId).single();
    expect(data!.status).toBe("pending");
    expect(new Date(data!.expires_at).getTime()).toBeGreaterThan(Date.now() + 29 * 864e5);
    expect(
      hint((await team.client.rpc("create_continuation_request", requestArgs(fx.projectId, fx.taskId))).error),
    ).toBe("open_request");
    expect(await files(team, fx.projectId)).toEqual([]);
  });

  it("only an owner decides, and the agreement needs an approved request", async () => {
    expect(
      (await team.client.rpc("decide_request", { p_request_id: requestId, p_decision: "approved", p_note: "" })).error
        ?.message,
    ).toMatch(/Only an owner/);
    expect(hint((await team.client.rpc("accept_agreement", { p_request_id: requestId })).error)).toBe("not_approved");
    expect(
      (await owner.client.rpc("decide_request", { p_request_id: requestId, p_decision: "approved", p_note: "" })).error,
    ).toBeNull();
    expect(await files(team, fx.projectId)).toEqual([]); // approval alone does not unlock
  });

  it("access is per person: each teammate accepts once, a stranger and an owner cannot", async () => {
    const stranger = await mk("stranger");
    expect(hint((await stranger.client.rpc("accept_agreement", { p_request_id: requestId })).error)).toBe(
      "not_in_request",
    );
    expect(hint((await owner.client.rpc("accept_agreement", { p_request_id: requestId })).error)).toBe("own_project");

    expect((await team.client.rpc("accept_agreement", { p_request_id: requestId })).error).toBeNull();
    expect(await files(team, fx.projectId)).toHaveLength(1);
    expect(await files(mate, fx.projectId)).toEqual([]); // the teammate has not accepted yet
    expect((await mate.client.rpc("accept_agreement", { p_request_id: requestId })).error).toBeNull();
    expect(await files(mate, fx.projectId)).toHaveLength(1);
    expect(await files(stranger, fx.projectId)).toEqual([]);

    const rows = await accessRows(fx.projectId);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.request_id === requestId)).toBe(true);
    // two people from one team count as one active team
    expect((await owner.client.rpc("active_adopter_count", { pid: fx.projectId })).data).toBe(1);
    expect((await team.client.rpc("accept_agreement", { p_request_id: requestId })).data).toMatchObject({
      already: true,
    });
    expect(await lineage(fx.projectId)).toEqual(
      expect.arrayContaining(["requested", "approved", "agreement_signed", "access_taken", "continued"]),
    );
  });

  it("revoking removes access, tells the holder, and cannot be undone by the holder", async () => {
    const [row] = (await accessRows(fx.projectId)).filter((r) => r.profile_id === mate.id);
    expect((await mate.client.rpc("revoke_access", { p_access: row.id, p_reason: REASON })).error?.message).toMatch(
      /Only an owner/,
    );
    expect(
      (await owner.client.rpc("revoke_access", { p_access: row.id, p_reason: "too short" })).error?.message,
    ).toMatch(/at least 15/);
    expect((await owner.client.rpc("revoke_access", { p_access: row.id, p_reason: REASON })).error).toBeNull();
    expect(await files(mate, fx.projectId)).toEqual([]);
    expect(await files(team, fx.projectId)).toHaveLength(1); // the rest of the team keeps access
    const note = await svc.from("notifications").select("payload").eq("user_id", mate.id).eq("type", "access_revoked");
    expect(note.data).toHaveLength(1);
    expect((note.data![0].payload as { reason: string }).reason).toBe(REASON);
    expect(hint((await owner.client.rpc("revoke_access", { p_access: row.id, p_reason: REASON })).error)).toBe(
      "already_revoked",
    );
    expect(hint((await mate.client.rpc("accept_agreement", { p_request_id: requestId })).error)).toBe("access_revoked");
    expect(await accessRows(fx.projectId, "revoked")).toHaveLength(1);
  });

  it("decline, withdraw, and the re-apply cooldown", async () => {
    const fx2 = await publishedProject(owner, { mode: "by_request" });
    const u = await mk("cooldown");
    const r1 = (await u.client.rpc("create_continuation_request", requestArgs(fx2.projectId, fx2.taskId)))
      .data as string;
    expect(
      (await owner.client.rpc("decide_request", { p_request_id: r1, p_decision: "declined", p_note: "Not now" })).error,
    ).toBeNull();
    expect(
      hint((await owner.client.rpc("decide_request", { p_request_id: r1, p_decision: "approved", p_note: "" })).error),
    ).toBe("already_decided");
    expect(
      hint((await u.client.rpc("create_continuation_request", requestArgs(fx2.projectId, fx2.taskId))).error),
    ).toBe("reapply_cooldown");
    // after the cooldown the same account can apply again
    await svc
      .from("continuation_requests")
      .update({ decided_at: new Date(Date.now() - 8 * 864e5).toISOString() })
      .eq("id", r1);
    const r2 = await u.client.rpc("create_continuation_request", requestArgs(fx2.projectId, fx2.taskId));
    expect(r2.error).toBeNull();
    expect((await u.client.rpc("withdraw_request", { p_request_id: r2.data })).error).toBeNull();
    expect((await svc.from("continuation_requests").select("status").eq("id", r2.data).single()).data!.status).toBe(
      "withdrawn",
    );
  });

  it("the cooldown follows the setting", async () => {
    const fx2 = await publishedProject(owner, { mode: "by_request" });
    const u = await mk("cooldown2");
    const r1 = (await u.client.rpc("create_continuation_request", requestArgs(fx2.projectId, fx2.taskId)))
      .data as string;
    await owner.client.rpc("decide_request", { p_request_id: r1, p_decision: "declined", p_note: "" });
    await svc.from("app_settings").upsert({ key: "reapply_cooldown_days", value: 0 });
    try {
      expect(
        (await u.client.rpc("create_continuation_request", requestArgs(fx2.projectId, fx2.taskId))).error,
      ).toBeNull();
    } finally {
      await svc.from("app_settings").delete().eq("key", "reapply_cooldown_days");
    }
  });

  it("pending requests expire: deciding fails, the job marks them, both sides are told, and the account can apply again", async () => {
    const fx2 = await publishedProject(owner, { mode: "by_request" });
    const u = await mk("expiry");
    const rid = (await u.client.rpc("create_continuation_request", requestArgs(fx2.projectId, fx2.taskId)))
      .data as string;
    await svc
      .from("continuation_requests")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", rid);
    expect(
      hint((await owner.client.rpc("decide_request", { p_request_id: rid, p_decision: "approved", p_note: "" })).error),
    ).toBe("expired");
    // only the service role may run the job
    expect((await owner.client.rpc("expire_requests")).error).not.toBeNull();
    const run = await svc.rpc("expire_requests");
    expect(run.error).toBeNull();
    expect(run.data as number).toBeGreaterThanOrEqual(1);
    expect((await svc.from("continuation_requests").select("status").eq("id", rid).single()).data!.status).toBe(
      "expired",
    );
    const toApplicant = await svc.from("notifications").select("id").eq("user_id", u.id).eq("type", "request_expired");
    const toOwner = await svc
      .from("notifications")
      .select("payload")
      .eq("user_id", owner.id)
      .eq("type", "request_expired");
    expect(toApplicant.data).toHaveLength(1);
    expect((toOwner.data ?? []).some((n) => (n.payload as { request_id: string }).request_id === rid)).toBe(true);
    expect(await lineage(fx2.projectId)).toContain("request_expired");
    expect(
      (await u.client.rpc("create_continuation_request", requestArgs(fx2.projectId, fx2.taskId))).error,
    ).toBeNull();
  });

  it("a full quota blocks new requests, approvals and a second team's acceptance", async () => {
    const small = await publishedProject(owner, { mode: "by_request", max: 1 });
    const t1 = await mk("q1");
    const t2 = await mk("q2");
    const t3 = await mk("q3");
    const r1 = (await t1.client.rpc("create_continuation_request", requestArgs(small.projectId, small.taskId)))
      .data as string;
    const r2 = (await t2.client.rpc("create_continuation_request", requestArgs(small.projectId, small.taskId)))
      .data as string;
    expect(
      (await owner.client.rpc("decide_request", { p_request_id: r1, p_decision: "approved", p_note: "" })).error,
    ).toBeNull();
    expect(
      (await owner.client.rpc("decide_request", { p_request_id: r2, p_decision: "approved", p_note: "" })).error,
    ).toBeNull(); // quota counts active access, not approvals
    expect((await t1.client.rpc("accept_agreement", { p_request_id: r1 })).error).toBeNull();
    expect(hint((await t2.client.rpc("accept_agreement", { p_request_id: r2 })).error)).toBe("quota_full");
    expect(
      hint((await t3.client.rpc("create_continuation_request", requestArgs(small.projectId, small.taskId))).error),
    ).toBe("quota_full");
    const r4 = (
      await svc
        .from("continuation_requests")
        .insert({
          project_id: small.projectId,
          adopter_team_name: "X",
          plan: "p".repeat(50),
          purpose: "course",
          task_ids: [small.taskId],
          created_by: t3.id,
        })
        .select("id")
        .single()
    ).data!.id;
    expect(
      hint((await owner.client.rpc("decide_request", { p_request_id: r4, p_decision: "approved", p_note: "" })).error),
    ).toBe("quota_full");
  });

  it("a hidden project takes no new requests", async () => {
    const fx2 = await publishedProject(owner, { mode: "by_request" });
    await svc.from("projects").update({ moderation_status: "hidden" }).eq("id", fx2.projectId);
    const u = await mk("hidden");
    expect(
      hint((await u.client.rpc("create_continuation_request", requestArgs(fx2.projectId, fx2.taskId))).error),
    ).toBe("not_available");
  });
});
