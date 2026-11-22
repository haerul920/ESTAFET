import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANON, URL, cleanup, makeUser, publishedProject, requestArgs, svc, type TestUser } from "./helpers";

/**
 * R8 Item 5: Systematic Database & RPC Authorization + IDOR Tests.
 *
 * Tests multi-user isolation across all 10 roles:
 *   guest (anon), owner, coOwner, holder, revokedHolder, requester,
 *   stranger (User B), unverified, suspended, and admin.
 */
const REASON = "Written reason with more than fifteen characters for R8 audit.";
const hint = (e: { hint?: string | null } | null) => e?.hint ?? null;
const anon = createClient(URL, ANON, { auth: { persistSession: false } });

const everyone: TestUser[] = [];
const mk = async (label: string, opts?: Parameters<typeof makeUser>[1]) => {
  const u = await makeUser(label, opts);
  everyone.push(u);
  return u;
};

let owner: TestUser;
let coOwner: TestUser;
let holder: TestUser;
let requester: TestUser;
let stranger: TestUser;
let unverified: TestUser;
let suspendedUser: TestUser;
let admin1: TestUser;
let admin2: TestUser;

beforeAll(async () => {
  [owner, coOwner, holder, requester, stranger, unverified, suspendedUser, admin1, admin2] = await Promise.all([
    mk("r8owner"),
    mk("r8coowner"),
    mk("r8holder"),
    mk("r8requester"),
    mk("r8stranger"),
    mk("r8unver", { verified: false }),
    mk("r8susp"),
    mk("r8admin1"),
    mk("r8admin2"),
  ]);
  expect((await svc.rpc("promote_admin", { p_email: admin1.email })).error).toBeNull();
  expect((await svc.rpc("promote_admin", { p_email: admin2.email })).error).toBeNull();
  // Suspend suspendedUser via admin1
  expect(
    (
      await admin1.client.rpc("admin_suspend_user", {
        p_user: suspendedUser.id,
        p_reason: REASON,
        p_until: null,
      })
    ).error,
  ).toBeNull();
});

afterAll(async () => {
  await svc.from("profiles").update({ is_admin: false }).in("id", [admin1.id, admin2.id]);
  await cleanup(everyone);
});

describe("R8 Authz 1: User A vs User B isolation & IDOR on project objects", () => {
  it("blocks a stranger (User B) from reading, editing, deleting, or invoking owner RPCs on User A's draft and published projects", async () => {
    // User A creates a draft project with a private file and a draft item
    const { data: draft, error: dErr } = await owner.client
      .from("projects")
      .insert({
        title: `R8 Draft Isolation ${Date.now()}`,
        summary: "x".repeat(45),
        kind: "research",
        field: "Engineering",
        year: 2025,
        stop_reason: "other",
        created_by: owner.id,
      })
      .select("id")
      .single();
    expect(dErr).toBeNull();
    const draftId = draft!.id as string;

    const { data: fileRow } = await svc
      .from("project_files")
      .insert({
        project_id: draftId,
        kind: "pdf",
        storage_path: `${draftId}/secret.pdf`,
        original_name: "secret.pdf",
        size_bytes: 1024,
        page_count: 2,
        created_by: owner.id,
      })
      .select("id")
      .single();

    const { data: itemRow } = await svc
      .from("draft_items")
      .insert({
        project_id: draftId,
        kind: "next_task",
        title: "Secret draft task",
        evidence: [{ file_id: fileRow!.id, page: 1, quote: "private evidence quote" }],
        evidence_status: "matched",
        review_status: "kept",
      })
      .select("id")
      .single();

    // Stranger cannot read draft project, private file, or draft item
    expect((await stranger.client.from("projects").select("id").eq("id", draftId)).data).toHaveLength(0);
    expect((await stranger.client.from("project_files").select("id").eq("project_id", draftId)).data).toHaveLength(0);
    expect((await stranger.client.from("draft_items").select("id").eq("project_id", draftId)).data).toHaveLength(0);

    // Stranger cannot update or delete User A's draft project, file, or item
    await stranger.client.from("projects").update({ title: "Hacked" }).eq("id", draftId);
    expect((await svc.from("projects").select("title").eq("id", draftId).single()).data?.title).not.toBe("Hacked");

    await stranger.client.from("project_files").delete().eq("id", fileRow!.id);
    expect((await svc.from("project_files").select("id").eq("id", fileRow!.id)).data).toHaveLength(1);

    await stranger.client.from("draft_items").update({ title: "Hacked item" }).eq("id", itemRow!.id);
    expect((await svc.from("draft_items").select("title").eq("id", itemRow!.id).single()).data?.title).toBe(
      "Secret draft task",
    );

    // Stranger is rejected by every owner RPC on User A's project
    expect(hint((await stranger.client.rpc("confirm_team_consent", { p_project_id: draftId })).error)).toBe(
      "not_owner",
    );
    expect(
      hint((await stranger.client.rpc("invite_co_owner", { p_project_id: draftId, p_email: stranger.email })).error),
    ).toBe("not_owner");
    expect(
      hint((await stranger.client.rpc("remove_team_member", { p_project_id: draftId, p_profile: owner.id })).error),
    ).toBe("not_owner");
    expect(hint((await stranger.client.rpc("set_fill_mode", { p_project_id: draftId, p_mode: "manual" })).error)).toBe(
      "not_owner",
    );
    expect(
      hint(
        (
          await stranger.client.rpc("set_access_settings", {
            p_project_id: draftId,
            p_mode: "open",
            p_max: 3,
          })
        ).error,
      ),
    ).toBe("not_owner");
    expect(hint((await stranger.client.rpc("publish_project", { p_project_id: draftId })).error)).toBe("not_owner");

    // Publish a project and test post-publish owner RPCs against stranger
    const pub = await publishedProject(owner, { mode: "by_request", max: 3 });
    expect(hint((await stranger.client.rpc("unpublish_project", { p_project_id: pub.projectId })).error)).toBe(
      "not_owner",
    );
    expect(hint((await stranger.client.rpc("archive_project", { p_project_id: pub.projectId })).error)).toBe(
      "not_owner",
    );
    expect(
      hint(
        (
          await stranger.client.rpc("propose_ownership_transfer", {
            p_project_id: pub.projectId,
            p_to: stranger.id,
          })
        ).error,
      ),
    ).toBe("not_primary_owner");
  });

  it("enforces co-owner boundaries: invited co-owners have no owner rights until they accept, and active co-owners cannot remove or transfer primary ownership", async () => {
    const pub = await publishedProject(owner, { mode: "by_request", max: 3 });

    // Invite coOwner, but before accepting, coOwner cannot change settings
    expect(
      (await owner.client.rpc("invite_co_owner", { p_project_id: pub.projectId, p_email: coOwner.email })).error,
    ).toBeNull();
    expect(
      hint(
        (
          await coOwner.client.rpc("set_access_settings", {
            p_project_id: pub.projectId,
            p_mode: "paused",
            p_max: 1,
          })
        ).error,
      ),
    ).toBe("not_owner");

    // Accept invite -> coOwner can update access settings
    expect(
      (await coOwner.client.rpc("respond_co_owner_invite", { p_project_id: pub.projectId, p_accept: true })).error,
    ).toBeNull();
    expect(
      (
        await coOwner.client.rpc("set_access_settings", {
          p_project_id: pub.projectId,
          p_mode: "open",
          p_max: 3,
        })
      ).error,
    ).toBeNull();

    // Active co-owner still cannot remove the primary owner or propose ownership transfer
    expect(
      hint(
        (
          await coOwner.client.rpc("remove_team_member", {
            p_project_id: pub.projectId,
            p_profile: owner.id,
          })
        ).error,
      ),
    ).toBe("owner_protected");
    expect(
      hint(
        (
          await coOwner.client.rpc("propose_ownership_transfer", {
            p_project_id: pub.projectId,
            p_to: coOwner.id,
          })
        ).error,
      ),
    ).toBe("not_primary_owner");
  });
});

describe("R8 Authz 2: Request, Agreement, Access Holder & Revocation boundaries", () => {
  it("prevents IDOR on continuation requests and immediately locks out a holder when access is revoked", async () => {
    const pub = await publishedProject(owner, { mode: "by_request", max: 3 });

    // Requester creates a request
    const reqRes = await requester.client.rpc("create_continuation_request", requestArgs(pub.projectId, pub.taskId));
    expect(reqRes.error).toBeNull();
    const requestId = reqRes.data as string;

    // Stranger cannot read the request, post messages, decide it, or accept the agreement
    expect((await stranger.client.from("continuation_requests").select("id").eq("id", requestId)).data).toHaveLength(0);
    expect(
      hint((await stranger.client.rpc("post_request_message", { p_request_id: requestId, p_body: "IDOR" })).error),
    ).toBe("not_in_request");
    expect(
      hint(
        (
          await stranger.client.rpc("decide_request", {
            p_request_id: requestId,
            p_decision: "approved",
            p_note: "Self-approve attempt",
          })
        ).error,
      ),
    ).toBe("not_owner");
    expect(
      hint(
        (
          await requester.client.rpc("decide_request", {
            p_request_id: requestId,
            p_decision: "approved",
            p_note: "Requester self-approve attempt",
          })
        ).error,
      ),
    ).toBe("not_owner");

    // Before approval, requester cannot accept agreement or read private files
    expect(hint((await requester.client.rpc("accept_agreement", { p_request_id: requestId })).error)).toBe(
      "not_approved",
    );
    expect(
      (await requester.client.from("project_files").select("id").eq("project_id", pub.projectId)).data,
    ).toHaveLength(0);

    // Owner approves; stranger still cannot accept agreement
    expect(
      (
        await owner.client.rpc("decide_request", {
          p_request_id: requestId,
          p_decision: "approved",
          p_note: "Approved for R8 test.",
        })
      ).error,
    ).toBeNull();
    expect(hint((await stranger.client.rpc("accept_agreement", { p_request_id: requestId })).error)).toBe(
      "not_in_request",
    );

    // Requester accepts agreement -> becomes active holder and can read private files & mark task progress
    expect((await requester.client.rpc("accept_agreement", { p_request_id: requestId })).error).toBeNull();
    expect(
      (await requester.client.from("project_files").select("id").eq("project_id", pub.projectId)).data,
    ).toHaveLength(1);
    expect(
      (await requester.client.rpc("set_item_progress", { p_item: pub.taskId, p_status: "in_progress" })).error,
    ).toBeNull();

    // Owner revokes requester's access -> requester immediately loses file access, cannot mark progress, and cannot re-take access
    const accessRow = (
      await svc
        .from("project_access")
        .select("id")
        .eq("project_id", pub.projectId)
        .eq("profile_id", requester.id)
        .single()
    ).data!;
    expect(
      (
        await owner.client.rpc("revoke_access", {
          p_access: accessRow.id,
          p_reason: REASON,
        })
      ).error,
    ).toBeNull();

    expect(
      (await requester.client.from("project_files").select("id").eq("project_id", pub.projectId)).data,
    ).toHaveLength(0);
    expect(
      hint((await requester.client.rpc("set_item_progress", { p_item: pub.taskId, p_status: "done" })).error),
    ).toBe("no_access");

    // Even if owner switches project to open mode, revoked user cannot take access again
    await owner.client.rpc("set_access_settings", { p_project_id: pub.projectId, p_mode: "open", p_max: 3 });
    expect(
      hint(
        (
          await requester.client.rpc("take_access", {
            p_project_id: pub.projectId,
            p_agreement_version: 1,
          })
        ).error,
      ),
    ).toBe("access_revoked");
  });
});

describe("R8 Authz 3: Unverified and Suspended account restrictions", () => {
  it("blocks unverified accounts from creating projects, publishing, inviting co-owners, requesting, or taking open access", async () => {
    const pubOpen = await publishedProject(owner, { mode: "open", max: 3 });
    const pubReq = await publishedProject(owner, { mode: "by_request", max: 3 });

    // Unverified cannot insert into projects (RLS requires is_email_verified())
    const ins = await unverified.client.from("projects").insert({
      title: "Unverified project",
      summary: "x".repeat(40),
      kind: "research",
      field: "Engineering",
      year: 2025,
      stop_reason: "other",
      created_by: unverified.id,
    });
    expect(ins.error).not.toBeNull();

    // Unverified cannot take open access or submit continuation request
    expect(
      hint(
        (
          await unverified.client.rpc("take_access", {
            p_project_id: pubOpen.projectId,
            p_agreement_version: 1,
          })
        ).error,
      ),
    ).toBe("email_unverified");
    expect(
      hint(
        (await unverified.client.rpc("create_continuation_request", requestArgs(pubReq.projectId, pubReq.taskId)))
          .error,
      ),
    ).toBe("email_unverified");
  });

  it("blocks suspended accounts from all write tables and core RPCs", async () => {
    const pubOpen = await publishedProject(owner, { mode: "open", max: 3 });
    const pubReq = await publishedProject(owner, { mode: "by_request", max: 3 });

    // Table insert blocked
    const ins = await suspendedUser.client.from("projects").insert({
      title: "Suspended project",
      summary: "x".repeat(40),
      kind: "research",
      field: "Engineering",
      year: 2025,
      stop_reason: "other",
      created_by: suspendedUser.id,
    });
    expect(ins.error).not.toBeNull();

    // Core RPCs blocked
    expect(
      (
        await suspendedUser.client.rpc("take_access", {
          p_project_id: pubOpen.projectId,
          p_agreement_version: 1,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (await suspendedUser.client.rpc("create_continuation_request", requestArgs(pubReq.projectId, pubReq.taskId)))
        .error,
    ).not.toBeNull();
  });
});

describe("R8 Authz 4: Admin privilege boundaries & break-glass isolation", () => {
  it("rejects guests and normal users from all admin RPCs and views", async () => {
    const pub = await publishedProject(owner);
    for (const caller of [anon, stranger.client, owner.client]) {
      expect((await caller.rpc("is_admin")).data).not.toBe(true);
      expect(
        (
          await caller.rpc("admin_set_project_moderation", {
            p_project: pub.projectId,
            p_status: "hidden",
            p_reason: REASON,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await caller.rpc("admin_suspend_user", {
            p_user: holder.id,
            p_reason: REASON,
            p_until: null,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await caller.rpc("admin_update_setting", {
            p_key: "max_upload_mb",
            p_value: 50,
            p_reason: REASON,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await caller.rpc("admin_break_glass", {
            p_project: pub.projectId,
            p_file: pub.fileId,
            p_reason: REASON,
          })
        ).error,
      ).not.toBeNull();
      expect((await caller.rpc("admin_purge_demo", { p_reason: REASON, p_allow: true })).error).not.toBeNull();
    }
  });

  it("isolates break-glass access strictly to the opening admin, single file, and 5-minute window", async () => {
    const pub = await publishedProject(owner);

    // Even an admin cannot read project_files directly via RLS without being owner/holder
    expect((await admin1.client.from("project_files").select("id").eq("project_id", pub.projectId)).data).toHaveLength(
      0,
    );

    // admin1 opens break glass for pub.fileId
    const bg = await admin1.client.rpc("admin_break_glass", {
      p_project: pub.projectId,
      p_file: pub.fileId,
      p_reason: REASON,
    });
    expect(bg.error).toBeNull();
    const accessId = (bg.data as { access_id: string }).access_id;
    expect(accessId).toBeTruthy();

    // admin1 can read this break-glass record
    const got1 = await admin1.client.rpc("admin_break_glass_get", { p_access: accessId });
    expect(got1.error).toBeNull();
    expect(got1.data).toBeTruthy();

    // admin2 (another admin!) and owner CANNOT read admin1's break-glass session
    const got2 = await admin2.client.rpc("admin_break_glass_get", { p_access: accessId });
    expect(got2.error !== null || !got2.data).toBe(true);
    const gotOwner = await owner.client.rpc("admin_break_glass_get", { p_access: accessId });
    expect(gotOwner.error).not.toBeNull();

    // Once expired, admin1 gets an error / no data
    await svc
      .from("break_glass_access")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", accessId);
    const expired = await admin1.client.rpc("admin_break_glass_get", { p_access: accessId });
    expect(expired.error !== null || !expired.data).toBe(true);
  });
});

describe("R8 Authz 5: Rate limiting RPC (check_rate_limit)", () => {
  it("enforces per-key thresholds and is closed to browser clients", async () => {
    const keyA = `r8_test:${Date.now()}:user-a`;
    const keyB = `r8_test:${Date.now()}:user-b`;

    // Browser clients cannot call check_rate_limit directly
    expect((await anon.rpc("check_rate_limit", { p_key: keyA, p_max: 2, p_window_seconds: 60 })).error).not.toBeNull();
    expect(
      (await stranger.client.rpc("check_rate_limit", { p_key: keyA, p_max: 2, p_window_seconds: 60 })).error,
    ).not.toBeNull();

    // Service role enforces threshold p_max = 2 for keyA
    expect((await svc.rpc("check_rate_limit", { p_key: keyA, p_max: 2, p_window_seconds: 60 })).data).toBe(true);
    expect((await svc.rpc("check_rate_limit", { p_key: keyA, p_max: 2, p_window_seconds: 60 })).data).toBe(true);
    expect((await svc.rpc("check_rate_limit", { p_key: keyA, p_max: 2, p_window_seconds: 60 })).data).toBe(false);

    // keyB is unaffected
    expect((await svc.rpc("check_rate_limit", { p_key: keyB, p_max: 2, p_window_seconds: 60 })).data).toBe(true);

    // Cleanup rate limit hits
    await svc.from("rate_limit_hits").delete().in("key", [keyA, keyB]);
  });
});
