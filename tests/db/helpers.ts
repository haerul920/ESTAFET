import "./env";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const PASSWORD = "Db-Test-Pass-2026!";
export const svc = createClient(URL, SERVICE, { auth: { persistSession: false } });

let counter = 0;
const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

/**
 * Un-confirms an account's email. GoTrue refuses to sign in an unconfirmed user, so the tests sign in first and then
 * clear `email_confirmed_at` directly in the LOCAL database (the existing session keeps working, the DB rule sees "unverified").
 */
function clearEmailConfirmation(userId: string) {
  if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error("Unexpected user id");
  execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_estafet",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `update auth.users set email_confirmed_at = null where id = '${userId}'`,
    ],
    { stdio: "pipe" },
  );
}

/** A signed-in user. `verified: false` gives an account whose email is not confirmed. */
export async function makeUser(
  label: string,
  opts: { verified?: boolean; policies?: boolean } = {},
): Promise<TestUser> {
  const email = `db.${label}.${run}.${counter++}@example.test`;
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `DB ${label}` },
  });
  if (error) throw error;
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  if (opts.verified === false) clearEmailConfirmation(data.user.id);
  if (opts.policies !== false && opts.verified !== false) {
    const r = await client.rpc("accept_current_policies");
    if (r.error) throw r.error;
  }
  return { id: data.user.id, email, client };
}

export interface Fixture {
  projectId: string;
  taskId: string;
  fileId: string;
}

/** A published project owned by `owner`: one file, one kept next task, team consented. */
export async function publishedProject(
  owner: TestUser,
  opts: { mode?: "open" | "by_request"; max?: number | null; title?: string } = {},
): Promise<Fixture> {
  const { data, error } = await owner.client
    .from("projects")
    .insert({
      title: opts.title ?? `DB Access ${run}-${counter++}`,
      summary: "x".repeat(40),
      kind: "research",
      field: "Engineering",
      year: 2025,
      stop_reason: "other",
      created_by: owner.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  const projectId = data.id as string;
  const f = await svc
    .from("project_files")
    .insert({
      project_id: projectId,
      kind: "markdown",
      storage_path: "x/y.md",
      original_name: "notes.md",
      created_by: owner.id,
    })
    .select("id")
    .single();
  if (f.error) throw f.error;
  const t = await svc
    .from("draft_items")
    .insert({
      project_id: projectId,
      kind: "next_task",
      title: "A task",
      effort: "small",
      evidence: [{ file_id: f.data.id, page: 1, quote: "q" }],
      evidence_status: "matched",
      review_status: "kept",
    })
    .select("id")
    .single();
  if (t.error) throw t.error;
  const consent = await owner.client.rpc("confirm_team_consent", { p_project_id: projectId });
  if (consent.error) throw consent.error;
  const pub = await owner.client.rpc("publish_project", { p_project_id: projectId });
  if (pub.error) throw pub.error;
  if (opts.mode || opts.max !== undefined) {
    const s = await owner.client.rpc("set_access_settings", {
      p_project_id: projectId,
      p_mode: opts.mode ?? "by_request",
      p_max: opts.max === undefined ? 3 : opts.max,
    });
    if (s.error) throw s.error;
  }
  return { projectId, taskId: t.data.id as string, fileId: f.data.id as string };
}

export function requestArgs(projectId: string, taskId: string, extra: Record<string, unknown> = {}) {
  return {
    p_project_id: projectId,
    p_team_name: "Team DB",
    p_members: [],
    p_task_ids: [taskId],
    p_plan: "p".repeat(50),
    p_purpose: "course",
    p_target_date: null,
    p_fit_note: "",
    ...extra,
  };
}

export async function cleanup(users: TestUser[]) {
  // lineage is append-only, so projects stay; users and the rows that cascade from them are removed where allowed.
  for (const u of users) await svc.auth.admin.deleteUser(u.id).catch(() => undefined);
}
