import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, makeUser, publishedProject, requestArgs, svc, type TestUser } from "./helpers";

/** R4 rules: fill mode, watchers, the request thread, backlog progress, expiry reminders and ownership transfer. */
const hint = (e: { hint?: string | null } | null) => e?.hint ?? null;
const notes = async (userId: string, type: string) =>
  (await svc.from("notifications").select("payload").eq("user_id", userId).eq("type", type)).data ?? [];
const lineage = async (projectId: string) =>
  ((await svc.from("lineage_events").select("type").eq("project_id", projectId)).data ?? []).map(
    (e) => e.type as string,
  );

const everyone: TestUser[] = [];
const mk = async (label: string, opts?: Parameters<typeof makeUser>[1]) => {
  const u = await makeUser(label, opts);
  everyone.push(u);
  return u;
};

let owner: TestUser;
let guest: TestUser;
let holder: TestUser;

beforeAll(async () => {
  owner = await mk("r4owner");
  guest = await mk("r4guest");
  holder = await mk("r4holder");
});
afterAll(() => cleanup(everyone));

async function draftProject(by: TestUser) {
  const { data, error } = await by.client
    .from("projects")
    .insert({
      title: `R4 Draft ${Date.now()}${Math.random()}`,
      summary: "x".repeat(40),
      kind: "research",
      field: "Engineering",
      year: 2025,
      stop_reason: "other",
      advisor_name: "Dr. A",
      advisor_email: "a@example.test",
      created_by: by.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

describe("fill mode (manual or AI)", () => {
  it("an owner picks a mode while the project is editable, nobody else can, and only two values exist", async () => {
    const id = await draftProject(owner);
    expect((await owner.client.rpc("set_fill_mode", { p_project_id: id, p_mode: "manual" })).error).toBeNull();
    expect((await svc.from("projects").select("fill_mode").eq("id", id).single()).data?.fill_mode).toBe("manual");
    expect(hint((await guest.client.rpc("set_fill_mode", { p_project_id: id, p_mode: "ai" })).error)).toBe("not_owner");
    expect(hint((await owner.client.rpc("set_fill_mode", { p_project_id: id, p_mode: "robot" })).error)).toBe(
      "bad_mode",
    );
  });

  it("is locked once the project is published", async () => {
    const f = await publishedProject(owner);
    expect(hint((await owner.client.rpc("set_fill_mode", { p_project_id: f.projectId, p_mode: "manual" })).error)).toBe(
      "not_editable",
    );
  });
});

describe("watchers: Beri tahu saya", () => {
  it("a visitor can watch a paused project and is told once when access opens again", async () => {
    const f = await publishedProject(owner, { mode: "paused", max: 3 });
    expect((await guest.client.rpc("watch_project", { p_project_id: f.projectId })).error).toBeNull();
    // a second call changes nothing
    expect((await guest.client.rpc("watch_project", { p_project_id: f.projectId })).error).toBeNull();
    expect(
      (await guest.client.from("project_watchers").select("project_id").eq("project_id", f.projectId)).data,
    ).toHaveLength(1);

    expect(
      (await owner.client.rpc("set_access_settings", { p_project_id: f.projectId, p_mode: "open", p_max: 3 })).error,
    ).toBeNull();
    const got = await notes(guest.id, "watch_open");
    expect(got.filter((n) => (n.payload as { project_id: string }).project_id === f.projectId)).toHaveLength(1);
    expect((got[0].payload as { reason: string }).reason).toBe("mode");
    // the wish is used up
    expect(
      (await guest.client.from("project_watchers").select("project_id").eq("project_id", f.projectId)).data,
    ).toHaveLength(0);
    // changing settings again does not notify again
    await owner.client.rpc("set_access_settings", { p_project_id: f.projectId, p_mode: "by_request", p_max: 3 });
    expect(
      (await notes(guest.id, "watch_open")).filter(
        (n) => (n.payload as { project_id: string }).project_id === f.projectId,
      ),
    ).toHaveLength(1);
  });

  it("a freed team slot notifies watchers of a full project", async () => {
    const f = await publishedProject(owner, { mode: "open", max: 1 });
    expect(
      (await holder.client.rpc("take_access", { p_project_id: f.projectId, p_agreement_version: 1 })).error,
    ).toBeNull();
    expect((await guest.client.rpc("watch_project", { p_project_id: f.projectId })).error).toBeNull();
    const before = (await notes(guest.id, "watch_open")).length;
    const acc = await svc
      .from("project_access")
      .select("id")
      .eq("project_id", f.projectId)
      .eq("status", "active")
      .single();
    expect(
      (
        await owner.client.rpc("revoke_access", {
          p_access: acc.data!.id,
          p_reason: "The team stopped answering messages.",
        })
      ).error,
    ).toBeNull();
    const after = await notes(guest.id, "watch_open");
    expect(after.length).toBe(before + 1);
    const mine = after.filter((n) => (n.payload as { project_id: string }).project_id === f.projectId);
    expect(mine).toHaveLength(1);
    expect((mine[0].payload as { reason: string }).reason).toBe("quota");
  });

  it("owners cannot watch their own project, and watching needs a published project", async () => {
    const f = await publishedProject(owner);
    expect(hint((await owner.client.rpc("watch_project", { p_project_id: f.projectId })).error)).toBe("own_project");
    const draft = await draftProject(owner);
    expect(hint((await guest.client.rpc("watch_project", { p_project_id: draft })).error)).toBe("not_available");
  });

  it("people only see their own watch list, and the internal notifier is closed to browsers", async () => {
    const f = await publishedProject(owner, { mode: "paused", max: 3 });
    await guest.client.rpc("watch_project", { p_project_id: f.projectId });
    expect(
      (await holder.client.from("project_watchers").select("project_id").eq("project_id", f.projectId)).data,
    ).toHaveLength(0);
    const direct = await guest.client.rpc("notify_watchers", { p_project_id: f.projectId, p_reason: "mode" });
    expect(direct.error).not.toBeNull();
    expect((await guest.client.rpc("unwatch_project", { p_project_id: f.projectId })).error).toBeNull();
    expect(
      (await guest.client.from("project_watchers").select("project_id").eq("project_id", f.projectId)).data,
    ).toHaveLength(0);
  });
});

describe("the request thread", () => {
  async function pendingRequest() {
    const f = await publishedProject(owner, { mode: "by_request", max: 3 });
    const r = await holder.client.rpc("create_continuation_request", requestArgs(f.projectId, f.taskId));
    expect(r.error).toBeNull();
    return { f, requestId: r.data as string };
  }

  it("owners and the team can write to each other, nobody else can read or write", async () => {
    const { requestId } = await pendingRequest();
    expect(
      (
        await owner.client.rpc("post_request_message", {
          p_request_id: requestId,
          p_body: "Which dataset will you start with?",
        })
      ).error,
    ).toBeNull();
    expect(
      (await holder.client.rpc("post_request_message", { p_request_id: requestId, p_body: "The 2024 survey, first." }))
        .error,
    ).toBeNull();
    expect((await holder.client.from("request_messages").select("body").eq("request_id", requestId)).data).toHaveLength(
      2,
    );
    expect((await owner.client.from("request_messages").select("body").eq("request_id", requestId)).data).toHaveLength(
      2,
    );
    expect(
      hint((await guest.client.rpc("post_request_message", { p_request_id: requestId, p_body: "Hi" })).error),
    ).toBe("not_in_request");
    expect((await guest.client.from("request_messages").select("body").eq("request_id", requestId)).data).toHaveLength(
      0,
    );
    // each side is notified
    expect((await notes(holder.id, "request_question")).length).toBeGreaterThan(0);
    expect((await notes(owner.id, "request_reply")).length).toBeGreaterThan(0);
  });

  it("a message needs text, stays short, and the thread closes after the decision", async () => {
    const { requestId } = await pendingRequest();
    expect(
      hint((await owner.client.rpc("post_request_message", { p_request_id: requestId, p_body: "   " })).error),
    ).toBe("message_empty");
    expect(
      hint(
        (await owner.client.rpc("post_request_message", { p_request_id: requestId, p_body: "x".repeat(501) })).error,
      ),
    ).toBe("message_long");
    expect(
      (
        await owner.client.rpc("decide_request", {
          p_request_id: requestId,
          p_decision: "declined",
          p_note: "Not now.",
        })
      ).error,
    ).toBeNull();
    expect(
      hint((await owner.client.rpc("post_request_message", { p_request_id: requestId, p_body: "Too late" })).error),
    ).toBe("already_decided");
  });

  it("the old owner question writes into the same thread", async () => {
    const { requestId } = await pendingRequest();
    expect(
      (
        await owner.client.rpc("ask_request_question", {
          p_request_id: requestId,
          p_message: "Can you share a schedule?",
        })
      ).error,
    ).toBeNull();
    const rows = (await svc.from("request_messages").select("body, author_id").eq("request_id", requestId)).data ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].author_id).toBe(owner.id);
    // a team member cannot use the owner-only function
    expect(
      hint((await holder.client.rpc("ask_request_question", { p_request_id: requestId, p_message: "Hello" })).error),
    ).toBe("not_owner");
  });
});

describe("backlog progress", () => {
  it("an access holder marks a task, it is logged in the lineage and the owners are told", async () => {
    const f = await publishedProject(owner, { mode: "open", max: 3 });
    expect(
      (await holder.client.rpc("take_access", { p_project_id: f.projectId, p_agreement_version: 1 })).error,
    ).toBeNull();
    expect(
      (await holder.client.rpc("set_item_progress", { p_item: f.taskId, p_status: "in_progress" })).error,
    ).toBeNull();
    expect((await svc.from("backlog_progress").select("status").eq("item_id", f.taskId).single()).data?.status).toBe(
      "in_progress",
    );
    expect((await holder.client.rpc("set_item_progress", { p_item: f.taskId, p_status: "done" })).error).toBeNull();
    expect((await svc.from("backlog_progress").select("status").eq("item_id", f.taskId).single()).data?.status).toBe(
      "done",
    );
    expect((await lineage(f.projectId)).filter((t) => t === "item_progress")).toHaveLength(2);
    expect((await notes(owner.id, "item_progress")).length).toBeGreaterThan(0);
    // access holders and owners can read it, outsiders cannot
    expect(
      (await holder.client.from("backlog_progress").select("status").eq("project_id", f.projectId)).data,
    ).toHaveLength(1);
    expect(
      (await guest.client.from("backlog_progress").select("status").eq("project_id", f.projectId)).data,
    ).toHaveLength(0);
    // clearing works
    expect((await holder.client.rpc("set_item_progress", { p_item: f.taskId, p_status: "none" })).error).toBeNull();
    expect((await svc.from("backlog_progress").select("status").eq("item_id", f.taskId)).data).toHaveLength(0);
  });

  it("people without access cannot mark, and only verified next tasks can be marked", async () => {
    const f = await publishedProject(owner, { mode: "open", max: 3 });
    expect(hint((await guest.client.rpc("set_item_progress", { p_item: f.taskId, p_status: "done" })).error)).toBe(
      "no_access",
    );
    const obj = await svc
      .from("draft_items")
      .insert({
        project_id: f.projectId,
        kind: "objective",
        title: "Obj",
        evidence: [],
        evidence_status: "matched",
        review_status: "kept",
      })
      .select("id")
      .single();
    expect(hint((await owner.client.rpc("set_item_progress", { p_item: obj.data!.id, p_status: "done" })).error)).toBe(
      "not_a_task",
    );
    expect(hint((await owner.client.rpc("set_item_progress", { p_item: f.taskId, p_status: "finished" })).error)).toBe(
      "bad_status",
    );
  });
});

describe("expiry reminders", () => {
  it("reminds the owners once, only for requests close to expiry, and is closed to browsers", async () => {
    const f = await publishedProject(owner, { mode: "by_request", max: 3 });
    const made = await holder.client.rpc("create_continuation_request", requestArgs(f.projectId, f.taskId));
    const requestId = made.data as string;
    // Not close to expiry yet: nothing to remind.
    const none = await svc.rpc("remind_expiring_requests", { p_days: 3 });
    expect(none.error).toBeNull();
    expect(
      (await notes(owner.id, "request_expiring")).filter(
        (n) => (n.payload as { request_id: string }).request_id === requestId,
      ),
    ).toHaveLength(0);
    // Two days left: reminded once.
    await svc
      .from("continuation_requests")
      .update({ expires_at: new Date(Date.now() + 2 * 864e5).toISOString() })
      .eq("id", requestId);
    await svc.rpc("remind_expiring_requests", { p_days: 3 });
    await svc.rpc("remind_expiring_requests", { p_days: 3 });
    expect(
      (await notes(owner.id, "request_expiring")).filter(
        (n) => (n.payload as { request_id: string }).request_id === requestId,
      ),
    ).toHaveLength(1);
    // Browsers cannot call it.
    expect((await owner.client.rpc("remind_expiring_requests", { p_days: 3 })).error).not.toBeNull();
  });
});

describe("ownership transfer", () => {
  async function teamProject() {
    const f = await publishedProject(owner);
    // owner invites a co-owner who accepts
    expect(
      (await owner.client.rpc("invite_co_owner", { p_project_id: f.projectId, p_email: holder.email })).error,
    ).toBeNull();
    expect(
      (await holder.client.rpc("respond_co_owner_invite", { p_project_id: f.projectId, p_accept: true })).error,
    ).toBeNull();
    return f;
  }

  it("needs the recipient to confirm, then swaps the roles and logs it", async () => {
    const f = await teamProject();
    expect(
      (await owner.client.rpc("propose_ownership_transfer", { p_project_id: f.projectId, p_to: holder.id })).error,
    ).toBeNull();
    // nothing changes before the answer
    expect(
      (
        await svc
          .from("project_members")
          .select("role")
          .eq("project_id", f.projectId)
          .eq("profile_id", owner.id)
          .single()
      ).data?.role,
    ).toBe("owner");
    expect((await notes(holder.id, "ownership_offer")).length).toBeGreaterThan(0);
    // a second proposal while one is pending is refused
    expect(
      hint(
        (await owner.client.rpc("propose_ownership_transfer", { p_project_id: f.projectId, p_to: holder.id })).error,
      ),
    ).toBe("transfer_pending");
    // the wrong person cannot answer
    expect(
      hint((await guest.client.rpc("respond_ownership_transfer", { p_project_id: f.projectId, p_accept: true })).error),
    ).toBe("no_transfer");
    expect(
      (await holder.client.rpc("respond_ownership_transfer", { p_project_id: f.projectId, p_accept: true })).error,
    ).toBeNull();
    const roles =
      (await svc.from("project_members").select("profile_id, role").eq("project_id", f.projectId)).data ?? [];
    expect(roles.find((r) => r.profile_id === holder.id)?.role).toBe("owner");
    expect(roles.find((r) => r.profile_id === owner.id)?.role).toBe("co_owner");
    expect(await lineage(f.projectId)).toContain("ownership_transferred");
  });

  it("can be declined or cancelled, goes only to an active co-owner, and only from the owner", async () => {
    const f = await teamProject();
    expect(
      hint((await owner.client.rpc("propose_ownership_transfer", { p_project_id: f.projectId, p_to: guest.id })).error),
    ).toBe("not_co_owner");
    expect(
      hint(
        (await holder.client.rpc("propose_ownership_transfer", { p_project_id: f.projectId, p_to: owner.id })).error,
      ),
    ).toBe("not_primary_owner");
    await owner.client.rpc("propose_ownership_transfer", { p_project_id: f.projectId, p_to: holder.id });
    expect(
      (await holder.client.rpc("respond_ownership_transfer", { p_project_id: f.projectId, p_accept: false })).error,
    ).toBeNull();
    expect(
      (
        await svc
          .from("project_members")
          .select("role")
          .eq("project_id", f.projectId)
          .eq("profile_id", owner.id)
          .single()
      ).data?.role,
    ).toBe("owner");
    await owner.client.rpc("propose_ownership_transfer", { p_project_id: f.projectId, p_to: holder.id });
    expect((await owner.client.rpc("cancel_ownership_transfer", { p_project_id: f.projectId })).error).toBeNull();
    expect(
      (await svc.from("ownership_transfers").select("status").eq("project_id", f.projectId).eq("status", "pending"))
        .data,
    ).toHaveLength(0);
  });
});
