import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANON, URL, cleanup, makeUser, requestArgs, svc, type TestUser } from "./helpers";

let owner: TestUser;
let stranger: TestUser;
let projectId: string;
let fileId: string;
let taskId: string;
const created: TestUser[] = [];

beforeAll(async () => {
  [owner, stranger] = await Promise.all([makeUser("owner"), makeUser("stranger")]);
  created.push(owner, stranger);

  // The owner makes a draft through the normal RLS path.
  const { data, error } = await owner.client
    .from("projects")
    .insert({ title: `DB Rules ${Date.now()}`, summary: "x".repeat(40), kind: "research", field: "Engineering", year: 2025, stop_reason: "other", advisor_name: "Dr. A", advisor_email: "a@example.test", created_by: owner.id })
    .select("id")
    .single();
  if (error) throw error;
  projectId = data.id;

  // A private file and one pending task (the service role stands in for the upload route).
  const f = await svc.from("project_files").insert({ project_id: projectId, kind: "markdown", storage_path: "x/y.md", original_name: "notes.md", created_by: owner.id }).select("id").single();
  fileId = f.data!.id;
  const t = await svc
    .from("draft_items")
    .insert({ project_id: projectId, kind: "next_task", title: "A task", effort: "small", evidence: [{ file_id: fileId, page: 1, quote: "q" }], evidence_status: "matched", review_status: "pending" })
    .select("id")
    .single();
  taskId = t.data!.id;
});

afterAll(() => cleanup(created));

describe("publish rule", () => {
  it("blocks publishing until the team confirmed, then while any item is pending", async () => {
    const early = await owner.client.rpc("publish_project", { p_project_id: projectId });
    expect(early.error?.message).toMatch(/Every team member must confirm/);
    await owner.client.rpc("confirm_team_consent", { p_project_id: projectId });
    const { error } = await owner.client.rpc("publish_project", { p_project_id: projectId });
    expect(error?.message).toMatch(/Review every drafted item/);
  });

  it("blocks people who do not own the project", async () => {
    const { error } = await stranger.client.rpc("publish_project", { p_project_id: projectId });
    expect(error?.message).toMatch(/Only an owner/);
  });

  it("does not let an owner change status or published_at directly", async () => {
    const { error } = await owner.client.from("projects").update({ status: "published" }).eq("id", projectId);
    expect(error).not.toBeNull(); // column privilege: status is not updatable by clients
  });

  it("publishes once everything is reviewed, and logs lineage", async () => {
    const up = await owner.client.from("draft_items").update({ review_status: "kept" }).eq("id", taskId);
    expect(up.error).toBeNull();
    const { error } = await owner.client.rpc("publish_project", { p_project_id: projectId });
    expect(error).toBeNull();
    const { data } = await svc.from("lineage_events").select("type").eq("project_id", projectId);
    expect(data!.map((e) => e.type)).toEqual(expect.arrayContaining(["created", "published"]));
  });
});

describe("private files", () => {
  it("a person with no relationship to the project cannot read private files or items", async () => {
    const files = await stranger.client.from("project_files").select("id").eq("project_id", projectId);
    expect(files.data).toEqual([]);
    const items = await stranger.client.from("draft_items").select("id").eq("project_id", projectId);
    expect(items.data).toEqual([]);
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    expect((await anon.from("project_files").select("id")).data).toEqual([]);
  });

  it("an owner can read them", async () => {
    const files = await owner.client.from("project_files").select("id").eq("project_id", projectId);
    expect(files.data).toHaveLength(1);
  });

  it("a pending request alone does not unlock anything", async () => {
    const { error, data } = await stranger.client.rpc("create_continuation_request", requestArgs(projectId, taskId));
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect((await stranger.client.from("project_files").select("id").eq("project_id", projectId)).data).toEqual([]);
  });
});

describe("lineage is append-only", () => {
  it("rejects update and delete, even for the service role", async () => {
    const { data } = await svc.from("lineage_events").select("id").eq("project_id", projectId).limit(1).single();
    const upd = await svc.from("lineage_events").update({ payload: { hacked: true } }).eq("id", data!.id);
    expect(upd.error?.message).toMatch(/append-only/);
    const del = await svc.from("lineage_events").delete().eq("id", data!.id);
    expect(del.error?.message).toMatch(/append-only/);
  });

  it("signed-in users cannot insert lineage rows", async () => {
    const r = await owner.client.from("lineage_events").insert({ project_id: projectId, type: "published" });
    expect(r.error).not.toBeNull();
  });
});

describe("server-only functions", () => {
  it("the old advisor functions no longer exist", async () => {
    // The product has no advisor role (R5). The endpoint that took advisor decisions is gone for everyone.
    for (const [fn, args] of [
      ["decide_advisor_consent", { p_token_hash: "x", p_decision: "approved", p_comment: "" }],
      ["issue_advisor_consent", { p_project_id: projectId, p_token_hash: "x", p_expires_at: new Date().toISOString() }],
      ["declare_no_advisor", { p_project_id: projectId }],
    ] as const) {
      expect((await owner.client.rpc(fn, args)).error, fn).not.toBeNull();
      expect((await svc.rpc(fn, args)).error, fn).not.toBeNull();
    }
  });

  it("publishing needs no advisor: the public view carries no advisor columns", async () => {
    const { data } = await svc.from("public_project_teaser").select("*").limit(1);
    const keys = Object.keys(data?.[0] ?? {});
    expect(keys).not.toEqual(expect.arrayContaining(["advisor_name"]));
    expect(keys).not.toEqual(expect.arrayContaining(["no_advisor"]));
  });

  it("internal helpers are not callable by users", async () => {
    for (const [fn, args] of [
      ["assert_verified", {}],
      ["setting_int", { p_key: "x", p_default: 1 }],
      ["refresh_team_size", { pid: projectId }],
      ["expire_requests", {}],
    ] as const) {
      expect((await owner.client.rpc(fn, args)).error, fn).not.toBeNull();
    }
  });
});
