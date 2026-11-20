import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "Db-Test-Pass-2026!";
const stamp = Date.now();

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

async function makeUser(label: string) {
  const email = `db.${label}.${stamp}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `DB ${label}` } });
  if (error) throw error;
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, client };
}

type U = Awaited<ReturnType<typeof makeUser>>;
let creator: U;
let adopter: U;
let stranger: U;
let projectId: string;
let fileId: string;
let taskId: string;
const created: string[] = [];

beforeAll(async () => {
  [creator, adopter, stranger] = await Promise.all([makeUser("creator"), makeUser("adopter"), makeUser("stranger")]);
  created.push(creator.id, adopter.id, stranger.id);

  // Creator makes a draft through the normal RLS path.
  const { data, error } = await creator.client
    .from("projects")
    .insert({ title: `DB Rules ${stamp}`, summary: "x".repeat(40), kind: "research", field: "Engineering", year: 2025, stop_reason: "other", advisor_name: "Dr. A", advisor_email: "a@example.test", created_by: creator.id })
    .select("id")
    .single();
  if (error) throw error;
  projectId = data.id;

  // A private file and one kept task (service role stands in for the upload route).
  const f = await admin.from("project_files").insert({ project_id: projectId, kind: "markdown", storage_path: "x/y.md", original_name: "notes.md", created_by: creator.id }).select("id").single();
  fileId = f.data!.id;
  const t = await admin
    .from("draft_items")
    .insert({ project_id: projectId, kind: "next_task", title: "A task", effort: "small", evidence: [{ file_id: fileId, page: 1, quote: "q" }], evidence_status: "matched", review_status: "pending" })
    .select("id")
    .single();
  taskId = t.data!.id;
});

afterAll(async () => {
  // lineage is append-only, so the project row stays; users and their data are removed where allowed.
  for (const id of created) await admin.auth.admin.deleteUser(id).catch(() => undefined);
});

describe("publish rule", () => {
  it("blocks publishing without advisor approval", async () => {
    await creator.client.rpc("confirm_team_consent", { p_project_id: projectId });
    const { error } = await creator.client.rpc("publish_project", { p_project_id: projectId });
    expect(error?.message).toMatch(/Advisor approval is required/);
  });

  it("blocks publishing while any item is pending, even after the advisor approved", async () => {
    await admin.from("advisor_consents").insert({ project_id: projectId, token_hash: `hash-${stamp}`, status: "approved", expires_at: new Date(Date.now() + 1e9).toISOString() });
    const { error } = await creator.client.rpc("publish_project", { p_project_id: projectId });
    expect(error?.message).toMatch(/Review every drafted item/);
  });

  it("blocks non-creators", async () => {
    const { error } = await stranger.client.rpc("publish_project", { p_project_id: projectId });
    expect(error?.message).toMatch(/Only a creator/);
  });

  it("does not let a creator change status or published_at directly", async () => {
    const { error } = await creator.client.from("projects").update({ status: "published" }).eq("id", projectId);
    expect(error).not.toBeNull(); // column privilege: status is not updatable by clients
  });

  it("publishes once everything is reviewed, and logs lineage", async () => {
    const up = await creator.client.from("draft_items").update({ review_status: "kept" }).eq("id", taskId);
    expect(up.error).toBeNull();
    const { error } = await creator.client.rpc("publish_project", { p_project_id: projectId });
    expect(error).toBeNull();
    const { data } = await admin.from("lineage_events").select("type").eq("project_id", projectId);
    expect(data!.map((e) => e.type)).toEqual(expect.arrayContaining(["created", "published"]));
  });
});

describe("private files and the unlock rule", () => {
  let requestId: string;

  it("a non-member cannot read private files or items", async () => {
    const files = await stranger.client.from("project_files").select("id").eq("project_id", projectId);
    expect(files.data).toEqual([]);
    const items = await stranger.client.from("draft_items").select("id").eq("project_id", projectId);
    expect(items.data).toEqual([]);
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    expect((await anon.from("project_files").select("id")).data).toEqual([]);
  });

  it("the creator can read them", async () => {
    const files = await creator.client.from("project_files").select("id").eq("project_id", projectId);
    expect(files.data).toHaveLength(1);
  });

  it("an adopter request needs a verified task and a published project", async () => {
    const bad = await adopter.client.rpc("create_continuation_request", {
      p_project_id: projectId, p_team_name: "T", p_members: [], p_task_ids: [], p_plan: "p".repeat(50), p_purpose: "course", p_target_date: null, p_fit_note: "",
    });
    expect(bad.error?.message).toMatch(/at least one verified task/);
    const ok = await adopter.client.rpc("create_continuation_request", {
      p_project_id: projectId, p_team_name: "Team DB", p_members: [{ email: `x.${stamp}@example.test` }], p_task_ids: [taskId], p_plan: "p".repeat(50), p_purpose: "course", p_target_date: null, p_fit_note: "",
    });
    expect(ok.error).toBeNull();
    requestId = ok.data as string;
  });

  it("creators cannot request their own project, and one open request per team", async () => {
    const own = await creator.client.rpc("create_continuation_request", {
      p_project_id: projectId, p_team_name: "T", p_members: [], p_task_ids: [taskId], p_plan: "p".repeat(50), p_purpose: "course", p_target_date: null, p_fit_note: "",
    });
    expect(own.error?.message).toMatch(/cannot request their own/);
    const dup = await adopter.client.rpc("create_continuation_request", {
      p_project_id: projectId, p_team_name: "Again", p_members: [], p_task_ids: [taskId], p_plan: "p".repeat(50), p_purpose: "course", p_target_date: null, p_fit_note: "",
    });
    expect(dup.error?.message).toMatch(/already has an open request/);
  });

  it("only a creator can decide", async () => {
    const r = await adopter.client.rpc("decide_request", { p_request_id: requestId, p_decision: "approved", p_note: "" });
    expect(r.error?.message).toMatch(/Only a creator/);
  });

  it("files stay locked after approval alone, and after one side accepts", async () => {
    expect((await creator.client.rpc("decide_request", { p_request_id: requestId, p_decision: "approved", p_note: "" })).error).toBeNull();
    expect((await adopter.client.from("project_files").select("id").eq("project_id", projectId)).data).toEqual([]);
    expect((await creator.client.rpc("accept_agreement", { p_request_id: requestId })).error).toBeNull();
    expect((await adopter.client.from("project_files").select("id").eq("project_id", projectId)).data).toEqual([]);
    expect((await adopter.client.from("draft_items").select("id").eq("project_id", projectId)).data).toEqual([]);
  });

  it("files unlock only when both sides accepted the current version", async () => {
    expect((await stranger.client.rpc("accept_agreement", { p_request_id: requestId })).error?.message).toMatch(/not part of this request/);
    expect((await adopter.client.rpc("accept_agreement", { p_request_id: requestId })).error).toBeNull();
    expect((await adopter.client.from("project_files").select("id").eq("project_id", projectId)).data).toHaveLength(1);
    expect((await adopter.client.from("draft_items").select("id").eq("project_id", projectId)).data).toHaveLength(1);
    expect((await stranger.client.from("project_files").select("id").eq("project_id", projectId)).data).toEqual([]);
    const { data } = await admin.from("lineage_events").select("type").eq("project_id", projectId);
    expect(data!.map((e) => e.type)).toEqual(expect.arrayContaining(["requested", "approved", "agreement_signed", "continued"]));
  });
});

describe("lineage is append-only", () => {
  it("rejects update and delete, even for the service role", async () => {
    const { data } = await admin.from("lineage_events").select("id").eq("project_id", projectId).limit(1).single();
    const upd = await admin.from("lineage_events").update({ payload: { hacked: true } }).eq("id", data!.id);
    expect(upd.error?.message).toMatch(/append-only/);
    const del = await admin.from("lineage_events").delete().eq("id", data!.id);
    expect(del.error?.message).toMatch(/append-only/);
  });

  it("signed-in users cannot insert lineage rows", async () => {
    const r = await creator.client.from("lineage_events").insert({ project_id: projectId, type: "published" });
    expect(r.error).not.toBeNull();
  });
});

describe("server-only functions", () => {
  const call = (c: SupabaseClient) => c.rpc("decide_advisor_consent", { p_token_hash: "x", p_decision: "approved", p_comment: "" });
  it("the advisor decision function is not callable by users or anonymous visitors", async () => {
    expect((await call(creator.client)).error).not.toBeNull();
    expect((await call(createClient(URL, ANON, { auth: { persistSession: false } }))).error).not.toBeNull();
    expect((await call(admin)).error).toBeNull(); // service role works (returns not_found)
  });

  it("advisor consent token hashes are not readable by creators", async () => {
    const r = await creator.client.from("advisor_consents").select("token_hash").eq("project_id", projectId);
    expect(r.error).not.toBeNull();
  });
});
