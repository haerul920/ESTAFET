import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
  it("blocks publishing without advisor approval", async () => {
    await owner.client.rpc("confirm_team_consent", { p_project_id: projectId });
    const { error } = await owner.client.rpc("publish_project", { p_project_id: projectId });
    expect(error?.message).toMatch(/Advisor approval is required/);
  });

  it("blocks publishing while any item is pending, even after the advisor approved", async () => {
    await svc.from("advisor_consents").insert({ project_id: projectId, token_hash: `hash-${projectId}`, status: "approved", expires_at: new Date(Date.now() + 1e9).toISOString() });
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
  const call = (c: SupabaseClient) => c.rpc("decide_advisor_consent", { p_token_hash: "x", p_decision: "approved", p_comment: "" });
  it("the advisor decision function is not callable by users or anonymous visitors", async () => {
    expect((await call(owner.client)).error).not.toBeNull();
    expect((await call(createClient(URL, ANON, { auth: { persistSession: false } }))).error).not.toBeNull();
    expect((await call(svc)).error).toBeNull(); // service role works (returns not_found)
  });

  it("advisor consent token hashes are not readable by owners", async () => {
    const r = await owner.client.from("advisor_consents").select("token_hash").eq("project_id", projectId);
    expect(r.error).not.toBeNull();
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
