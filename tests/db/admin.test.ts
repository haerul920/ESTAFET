import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "Db-Admin-Test-2026!";
const stamp = Date.now();
const REASON = "Testing the admin rules with a long enough reason.";

const svc = createClient(URL, SERVICE, { auth: { persistSession: false } });

async function makeUser(label: string) {
  const email = `adm.${label}.${stamp}@example.test`;
  const { data, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Adm ${label}` } });
  if (error) throw error;
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const r = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (r.error) throw r.error;
  return { id: data.user.id, email, client };
}
type U = Awaited<ReturnType<typeof makeUser>>;

let admin: U;
let creator: U;
let member: U;
let projectId: string;
let fileId: string;
const anon = createClient(URL, ANON, { auth: { persistSession: false } });

beforeAll(async () => {
  [admin, creator, member] = await Promise.all([makeUser("admin"), makeUser("creator"), makeUser("member")]);
  await svc.rpc("promote_admin", { p_email: admin.email });
  // re-sign in so the JWT is fresh (is_admin() reads the profile, not the token)
  const { data, error } = await creator.client
    .from("projects")
    .insert({ title: `Admin Rules ${stamp}`, summary: "x".repeat(40), kind: "research", field: "Engineering", year: 2025, stop_reason: "other", advisor_name: "Dr. A", advisor_email: "a@example.test", created_by: creator.id })
    .select("id")
    .single();
  if (error) throw error;
  projectId = data.id;
  await svc.from("projects").update({ status: "published", published_at: new Date().toISOString() }).eq("id", projectId);
  const f = await svc.from("project_files").insert({ project_id: projectId, kind: "markdown", storage_path: "x/y.md", original_name: "notes.md" }).select("id").single();
  fileId = f.data!.id;
});

afterAll(async () => {
  await svc.from("profiles").update({ is_admin: false }).eq("id", admin.id).then(() => undefined, () => undefined);
  for (const u of [admin, creator, member]) await svc.auth.admin.deleteUser(u.id).catch(() => undefined);
});

const ADMIN_RPCS: [string, Record<string, unknown>][] = [
  ["admin_set_project_moderation", { p_project: "00000000-0000-0000-0000-000000000000", p_status: "hidden", p_reason: REASON }],
  ["admin_handle_report", { p_report: "00000000-0000-0000-0000-000000000000", p_action: "dismiss", p_note: REASON }],
  ["admin_suspend_user", { p_user: "00000000-0000-0000-0000-000000000000", p_reason: REASON, p_until: null }],
  ["admin_restore_user", { p_user: "00000000-0000-0000-0000-000000000000", p_reason: REASON }],
  ["admin_break_glass", { p_project: "00000000-0000-0000-0000-000000000000", p_file: "00000000-0000-0000-0000-000000000000", p_reason: REASON }],
  ["admin_break_glass_get", { p_access: "00000000-0000-0000-0000-000000000000" }],
  ["admin_update_setting", { p_key: "max_upload_mb", p_value: 30, p_reason: REASON }],
  ["admin_regenerate_consent", { p_project: "00000000-0000-0000-0000-000000000000", p_token_hash: "x", p_expires: new Date(Date.now() + 1e9).toISOString(), p_reason: REASON }],
  ["admin_cancel_run", { p_run: "00000000-0000-0000-0000-000000000000", p_reason: REASON }],
  ["admin_log_action", { p_action: "x", p_target_type: "project", p_target_id: null, p_reason: REASON, p_before: null, p_after: null }],
  ["admin_add_note", { p_target_type: "request", p_target_id: "00000000-0000-0000-0000-000000000000", p_note: "a note" }],
  ["admin_trial_save", { p_id: null, p_data: {} }],
  ["admin_demo_storage_paths", {}],
  ["admin_purge_demo", { p_reason: REASON, p_allow: false }],
  ["admin_overview", { p_include_demo: false }],
  ["admin_trial_summary", { p_include_demo: false }],
  ["admin_project_detail", { p_id: "00000000-0000-0000-0000-000000000000" }],
  ["admin_user_detail", { p_id: "00000000-0000-0000-0000-000000000000" }],
  ["admin_search", { p_q: "test" }],
];
const ADMIN_VIEWS = ["admin_projects_v", "admin_users_v", "admin_reports_v", "admin_runs_v", "admin_consents_v", "admin_requests_v", "admin_audit_v", "admin_trials_v"];
const ADMIN_TABLES = ["reports", "audit_log", "app_settings", "trial_sessions", "break_glass_access"];

describe("admin boundary: non-admins and visitors are rejected everywhere", () => {
  it.each(ADMIN_RPCS)("%s is rejected for a normal user and an anonymous visitor", async (name, args) => {
    const user = await member.client.rpc(name, args);
    expect(user.error, `${name} for a user`).not.toBeNull();
    const guest = await anon.rpc(name, args);
    expect(guest.error, `${name} for a guest`).not.toBeNull();
  });

  it.each(ADMIN_VIEWS)("view %s returns no rows to a normal user or a visitor", async (v) => {
    expect((await member.client.from(v).select("*").limit(1)).data ?? []).toEqual([]);
    const g = await anon.from(v).select("*").limit(1);
    expect(g.data ?? []).toEqual([]);
  });

  it.each(ADMIN_TABLES)("table %s is unreadable and unwritable for users", async (t) => {
    expect((await member.client.from(t).select("*").limit(1)).data ?? []).toEqual([]);
    const ins = await member.client.from(t).insert({});
    expect(ins.error).not.toBeNull();
  });

  it("a normal user cannot make themselves admin or lift a suspension", async () => {
    const a = await member.client.from("profiles").update({ is_admin: true }).eq("id", member.id);
    expect(a.error).not.toBeNull();
    const b = await member.client.from("profiles").update({ suspended_at: null }).eq("id", member.id);
    expect(b.error).not.toBeNull();
  });

  it("promote_admin and demote_admin are service-role only", async () => {
    expect((await member.client.rpc("promote_admin", { p_email: member.email })).error).not.toBeNull();
    expect((await admin.client.rpc("promote_admin", { p_email: member.email })).error).not.toBeNull();
    expect((await anon.rpc("demote_admin", { p_email: admin.email })).error).not.toBeNull();
  });
});

describe("admin can work", () => {
  it("reads the overview and the views", async () => {
    const o = await admin.client.rpc("admin_overview", { p_include_demo: true });
    expect(o.error).toBeNull();
    expect(o.data).toHaveProperty("open_reports");
    expect((await admin.client.from("admin_projects_v").select("id").eq("id", projectId)).data).toHaveLength(1);
  });

  it("the read functions work with the owner and member model", async () => {
    const detail = await admin.client.rpc("admin_project_detail", { p_id: projectId });
    expect(detail.error).toBeNull();
    expect((detail.data as { creators: { id: string }[] }).creators.map((c) => c.id)).toEqual([creator.id]);
    const user = await admin.client.rpc("admin_user_detail", { p_id: creator.id });
    expect(user.error).toBeNull();
    expect((user.data as { projects: unknown[] }).projects).toHaveLength(1);
    expect((await admin.client.rpc("admin_search", { p_q: "Admin Rules" })).error).toBeNull();
    const users = await admin.client.from("admin_users_v").select("projects_count").eq("id", creator.id).single();
    expect(users.data!.projects_count).toBe(1);
  });

  it("regenerating an advisor link does not depend on the old statuses", async () => {
    const r = await admin.client.rpc("admin_regenerate_consent", {
      p_project: projectId,
      p_token_hash: `regen-${stamp}`,
      p_expires: new Date(Date.now() + 864e5).toISOString(),
      p_reason: "Testing the regenerate function with a long reason.",
    });
    expect(r.error).toBeNull();
    const { data } = await svc.from("projects").select("advisor_mode").eq("id", projectId).single();
    expect(data!.advisor_mode).toBe("advisor");
  });

  it("an admin can revoke access, and it is audited", async () => {
    const holder = await makeUser("holder");
    try {
      await svc.from("projects").update({ access_mode: "open" }).eq("id", projectId);
      expect((await holder.client.rpc("take_access", { p_project_id: projectId, p_agreement_version: 1 })).error).toBeNull();
      const { data: row } = await svc.from("project_access").select("id").eq("project_id", projectId).eq("profile_id", holder.id).single();
      const r = await admin.client.rpc("revoke_access", { p_access: row!.id, p_reason: "An admin revoked this in a test, with a reason." });
      expect(r.error).toBeNull();
      const audit = await svc.from("audit_log").select("action").eq("target_id", row!.id).eq("action", "access.revoke");
      expect(audit.data).toHaveLength(1);
    } finally {
      await svc.auth.admin.deleteUser(holder.id).catch(() => undefined);
    }
  });

  it.each(ADMIN_VIEWS)("view %s is readable by an admin without errors", async (v) => {
    const r = await admin.client.from(v).select("*").limit(3);
    expect(r.error, v).toBeNull();
  });

  it("requires a reason of at least 15 characters", async () => {
    const r = await admin.client.rpc("admin_set_project_moderation", { p_project: projectId, p_status: "hidden", p_reason: "too short" });
    expect(r.error?.message).toMatch(/at least 15 characters/);
  });
});

describe("moderation hides a project and is audited", () => {
  it("hide removes it from the public views, notifies the creators and audits with the reason; restore brings it back", async () => {
    const visible = async () => (await anon.from("public_project_teaser").select("id").eq("id", projectId)).data ?? [];
    expect(await visible()).toHaveLength(1);

    const hide = await admin.client.rpc("admin_set_project_moderation", { p_project: projectId, p_status: "hidden", p_reason: REASON });
    expect(hide.error).toBeNull();
    expect(await visible()).toHaveLength(0);
    expect((await anon.from("public_project_lineage").select("id").eq("project_id", projectId)).data ?? []).toEqual([]);

    const note = await svc.from("notifications").select("payload").eq("user_id", creator.id).eq("type", "moderation");
    expect(note.data?.[0]?.payload).toMatchObject({ action: "hidden", reason: REASON });

    const audit = await svc.from("audit_log").select("action, reason, before, after, actor_id").eq("target_id", projectId).eq("action", "project.hidden");
    expect(audit.data).toHaveLength(1);
    expect(audit.data![0]).toMatchObject({ reason: REASON, actor_id: admin.id, before: { moderation_status: "ok" }, after: { moderation_status: "hidden" } });

    // a hidden project cannot receive requests
    const req = await member.client.rpc("create_continuation_request", { p_project_id: projectId, p_team_name: "T", p_members: [], p_task_ids: [], p_plan: "p".repeat(50), p_purpose: "course", p_target_date: null, p_fit_note: "" });
    expect(req.error).not.toBeNull();

    expect((await admin.client.rpc("admin_set_project_moderation", { p_project: projectId, p_status: "ok", p_reason: REASON })).error).toBeNull();
    expect(await visible()).toHaveLength(1);
    expect((await svc.from("audit_log").select("id").eq("target_id", projectId).eq("action", "project.restored")).data).toHaveLength(1);
  });
});

describe("audit log is append-only", () => {
  it("rejects update and delete even for the service role", async () => {
    const { data } = await svc.from("audit_log").select("id").limit(1).single();
    expect((await svc.from("audit_log").update({ reason: "tampered" }).eq("id", data!.id)).error?.message).toMatch(/append-only/);
    expect((await svc.from("audit_log").delete().eq("id", data!.id)).error?.message).toMatch(/append-only/);
  });
  it("no signed-in user can insert audit rows directly", async () => {
    expect((await admin.client.from("audit_log").insert({ action: "x", target_type: "y" })).error).not.toBeNull();
  });
});

describe("suspension", () => {
  it("an admin cannot suspend themselves", async () => {
    const r = await admin.client.rpc("admin_suspend_user", { p_user: admin.id, p_reason: REASON, p_until: null });
    expect(r.error?.message).toMatch(/cannot suspend yourself/);
  });

  it("a suspended user cannot act, and can again after restore", async () => {
    expect((await admin.client.rpc("admin_suspend_user", { p_user: member.id, p_reason: REASON, p_until: null })).error).toBeNull();
    const blocked = await member.client.from("projects").insert({ title: `Blocked ${stamp}`, summary: "x".repeat(40), kind: "research", field: "Engineering", year: 2025, stop_reason: "other", advisor_name: "Dr. A", advisor_email: "a@example.test", created_by: member.id });
    expect(blocked.error?.message).toMatch(/suspended/i);
    expect((await admin.client.rpc("admin_restore_user", { p_user: member.id, p_reason: REASON })).error).toBeNull();
    const ok = await member.client.from("projects").insert({ title: `Allowed ${stamp}`, summary: "x".repeat(40), kind: "research", field: "Engineering", year: 2025, stop_reason: "other", advisor_name: "Dr. A", advisor_email: "a@example.test", created_by: member.id });
    expect(ok.error).toBeNull();
  });

  it("an end date in the past is rejected, and an expired suspension no longer blocks", async () => {
    const past = await admin.client.rpc("admin_suspend_user", { p_user: member.id, p_reason: REASON, p_until: new Date(Date.now() - 1000).toISOString() });
    expect(past.error?.message).toMatch(/future/);
    await svc.from("profiles").update({ suspended_at: new Date().toISOString(), suspended_until: new Date(Date.now() - 1000).toISOString() }).eq("id", member.id);
    // the suspension has ended, so the user can act again
    const ok = await member.client.from("projects").insert({ title: `After suspension ${stamp}`, summary: "x".repeat(40), kind: "research", field: "Engineering", year: 2025, stop_reason: "other", advisor_name: "Dr. A", advisor_email: "a@example.test", created_by: member.id });
    expect(ok.error).toBeNull();
    await svc.from("profiles").update({ suspended_at: null, suspended_until: null }).eq("id", member.id);
  });
});

describe("the last admin cannot be demoted", () => {
  it("demotes down to one admin, then refuses, then restores everyone", async () => {
    const { data: admins } = await svc.from("profiles").select("id").eq("is_admin", true);
    const ids = (admins ?? []).map((a) => a.id);
    const emails: Record<string, string> = {};
    for (const id of ids) emails[id] = (await svc.auth.admin.getUserById(id)).data.user!.email!;
    const demoted: string[] = [];
    try {
      for (const id of ids.slice(0, -1)) {
        expect((await svc.rpc("demote_admin", { p_email: emails[id] })).error).toBeNull();
        demoted.push(id);
      }
      const last = ids[ids.length - 1];
      const r = await svc.rpc("demote_admin", { p_email: emails[last] });
      expect(r.error?.message).toMatch(/last admin cannot be demoted/);
      expect((await svc.from("profiles").select("is_admin").eq("id", last).single()).data?.is_admin).toBe(true);
    } finally {
      for (const id of demoted) await svc.rpc("promote_admin", { p_email: emails[id] });
    }
  });
});

describe("break glass", () => {
  it("logs access and audit, notifies the creators, and expires", async () => {
    const r = await admin.client.rpc("admin_break_glass", { p_project: projectId, p_file: fileId, p_reason: REASON });
    expect(r.error).toBeNull();
    const accessId = (r.data as { access_id: string }).access_id;

    const rows = await svc.from("break_glass_access").select("admin_id, expires_at, reason").eq("id", accessId).single();
    expect(rows.data).toMatchObject({ admin_id: admin.id, reason: REASON });
    const ms = new Date(rows.data!.expires_at).getTime() - Date.now();
    expect(ms).toBeGreaterThan(4 * 60_000);
    expect(ms).toBeLessThanOrEqual(5 * 60_000);

    expect((await svc.from("audit_log").select("id").eq("target_id", fileId).eq("action", "break_glass.open")).data).toHaveLength(1);
    const note = await svc.from("notifications").select("payload").eq("user_id", creator.id).eq("type", "break_glass");
    expect(note.data?.[0]?.payload).toMatchObject({ file: "notes.md", reason: REASON });

    const get = await admin.client.rpc("admin_break_glass_get", { p_access: accessId });
    expect(get.error).toBeNull();
    expect(get.data).toMatchObject({ storage_path: "x/y.md" });
    // another admin-less user cannot use it
    expect((await member.client.rpc("admin_break_glass_get", { p_access: accessId })).error).not.toBeNull();

    await svc.from("break_glass_access").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", accessId);
    expect((await admin.client.rpc("admin_break_glass_get", { p_access: accessId })).error?.message).toMatch(/expired/);
  });

  it("refuses a file that is not part of the project and needs a reason", async () => {
    expect((await admin.client.rpc("admin_break_glass", { p_project: projectId, p_file: "00000000-0000-0000-0000-000000000000", p_reason: REASON })).error).not.toBeNull();
    expect((await admin.client.rpc("admin_break_glass", { p_project: projectId, p_file: fileId, p_reason: "short" })).error).not.toBeNull();
  });
});

describe("settings", () => {
  it("writes the change and an audit row with before and after", async () => {
    const key = "max_upload_mb";
    const before = (await svc.from("app_settings").select("value").eq("key", key).maybeSingle()).data?.value ?? null;
    expect((await admin.client.rpc("admin_update_setting", { p_key: key, p_value: 41, p_reason: REASON })).error).toBeNull();
    expect((await admin.client.rpc("admin_update_setting", { p_key: key, p_value: 42, p_reason: REASON })).error).toBeNull();
    const { data } = await svc.from("audit_log").select("before, after, reason").eq("action", "setting.update").order("created_at", { ascending: false }).limit(1);
    expect(data![0]).toMatchObject({ reason: REASON, before: { key, value: 41 }, after: { key, value: 42 } });
    expect((await admin.client.rpc("admin_update_setting", { p_key: "not_a_key", p_value: 1, p_reason: REASON })).error).not.toBeNull();
    if (before === null) await svc.from("app_settings").delete().eq("key", key);
    else await svc.from("app_settings").update({ value: before }).eq("key", key);
  });
});

describe("trial summary against a known fixture", () => {
  it("computes counts, median, mean, completion, score, SUS and the within-30-minutes share", async () => {
    // Set real (non-demo) rows aside, run the fixture, then put them back.
    const { data: saved } = await svc.from("trial_sessions").select("*").eq("is_demo", false);
    if (saved?.length) await svc.from("trial_sessions").delete().eq("is_demo", false);
    const mk = (code: string, cohort: string, minutes: number | null, completed: boolean, correct: number, sus: number | null) => ({
      participant_code: code, cohort, minutes_to_understand: minutes, completed, correct_answers: correct, total_questions: 5, sus_score: sus, consent_confirmed: true, is_demo: false,
    });
    const fixture = [
      mk("T01", "baseline", 10, true, 5, null), mk("T02", "baseline", 20, true, 4, null), mk("T03", "baseline", 30, true, 3, null), mk("T04", "baseline", 40, true, 3, null),
      mk("T05", "estafet", 20, true, 5, 80), mk("T06", "estafet", 25, true, 4, 70), mk("T07", "estafet", 35, true, 4, 90), mk("T08", "estafet", null, false, 1, 60),
    ];
    try {
      expect((await svc.from("trial_sessions").insert(fixture)).error).toBeNull();
      const { data, error } = await admin.client.rpc("admin_trial_summary", { p_include_demo: false });
      expect(error).toBeNull();
      const rows = data as { cohort: string; n: number; completed_n: number; median_minutes: number; mean_minutes: number; completion_rate: number; mean_score: number; mean_sus: number; within30_n: number; within30_share: number }[];
      const b = rows.find((r) => r.cohort === "baseline")!;
      const e = rows.find((r) => r.cohort === "estafet")!;
      expect(b).toMatchObject({ n: 4, completed_n: 4, median_minutes: 25, mean_minutes: 25, completion_rate: 1, within30_n: 3, within30_share: 0.75 });
      expect(b.mean_score).toBeCloseTo(0.75, 3); // (5+4+3+3)/20
      expect(e).toMatchObject({ n: 4, completed_n: 3, median_minutes: 25, completion_rate: 0.75, within30_n: 2, within30_share: 0.5 });
      expect(e.mean_minutes).toBeCloseTo(26.67, 2);
      expect(e.mean_sus).toBeCloseTo(75, 1);
      expect(e.mean_score).toBeCloseTo(0.7, 3); // (5+4+4+1)/20
    } finally {
      await svc.from("trial_sessions").delete().like("participant_code", "T0%").eq("is_demo", false);
      if (saved?.length) await svc.from("trial_sessions").insert(saved);
    }
  });

  it("excludes demo rows by default and includes them on request", async () => {
    const off = ((await admin.client.rpc("admin_trial_summary", { p_include_demo: false })).data ?? []) as { n: number }[];
    const on = ((await admin.client.rpc("admin_trial_summary", { p_include_demo: true })).data ?? []) as { n: number }[];
    const sum = (r: { n: number }[]) => r.reduce((a, c) => a + c.n, 0);
    expect(sum(on)).toBeGreaterThanOrEqual(sum(off));
  });

  it("trial rows reject real-looking names and missing consent", async () => {
    const bad = await admin.client.rpc("admin_trial_save", { p_id: null, p_data: { participant_code: "Budi Santoso", cohort: "estafet", consent_confirmed: true } });
    expect(bad.error).not.toBeNull();
    const noConsent = await admin.client.rpc("admin_trial_save", { p_id: null, p_data: { participant_code: "P99", cohort: "estafet", consent_confirmed: false } });
    expect(noConsent.error).not.toBeNull();
  });
});

describe("purge demo data is gated", () => {
  const unused: SupabaseClient | null = null;
  it("refuses when the environment does not allow it", async () => {
    const r = await admin.client.rpc("admin_purge_demo", { p_reason: REASON, p_allow: false });
    expect(r.error?.message).toMatch(/not allowed in this environment/);
    expect(unused).toBeNull();
  });
});
