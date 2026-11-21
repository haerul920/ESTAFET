import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * DESTRUCTIVE: purging removes all demo data from the LOCAL stack. Run with `pnpm test:db:purge`, then
 * restore the demo data with `pnpm db:reset`. Proves that only is_demo rows are deleted (mixed data).
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stamp = Date.now();
const REASON = "Purge test with mixed demo and real data.";
const svc = createClient(URL, SERVICE, { auth: { persistSession: false } });

let adminId: string;
let adminClient: SupabaseClient;
let realProject: string;
let demoProject: string;

beforeAll(async () => {
  const email = `purge.admin.${stamp}@example.test`;
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password: "Purge-Test-2026!",
    email_confirm: true,
    user_metadata: { full_name: "Purge Admin" },
  });
  if (error) throw error;
  adminId = data.user.id;
  await svc.rpc("promote_admin", { p_email: email });
  adminClient = createClient(URL, ANON, { auth: { persistSession: false } });
  await adminClient.auth.signInWithPassword({ email, password: "Purge-Test-2026!" });

  const base = {
    summary: "x".repeat(40),
    kind: "research",
    field: "Engineering",
    year: 2025,
    stop_reason: "other",
    advisor_name: "Dr. A",
    advisor_email: "a@example.test",
    created_by: adminId,
    status: "published",
  };
  realProject = (
    await svc
      .from("projects")
      .insert({ ...base, title: `Real ${stamp}`, is_demo: false })
      .select("id")
      .single()
  ).data!.id;
  demoProject = (
    await svc
      .from("projects")
      .insert({ ...base, title: `Demo ${stamp}`, is_demo: true })
      .select("id")
      .single()
  ).data!.id;
  await svc.from("trial_sessions").insert([
    { participant_code: "PR1", cohort: "estafet", consent_confirmed: true, is_demo: false },
    { participant_code: "PD1", cohort: "estafet", consent_confirmed: true, is_demo: true },
  ]);
});

afterAll(async () => {
  await svc.from("trial_sessions").delete().eq("participant_code", "PR1");
  await svc.auth.admin.deleteUser(adminId).catch(() => undefined);
});

describe("purge demo data", () => {
  it("deletes only is_demo rows and writes an audit row", async () => {
    const r = await adminClient.rpc("admin_purge_demo", { p_reason: REASON, p_allow: true });
    expect(r.error).toBeNull();
    expect((await svc.from("projects").select("id").eq("id", realProject)).data).toHaveLength(1);
    expect((await svc.from("projects").select("id").eq("id", demoProject)).data).toHaveLength(0);
    expect((await svc.from("projects").select("id").eq("is_demo", true)).data).toHaveLength(0);
    expect((await svc.from("trial_sessions").select("id").eq("participant_code", "PR1")).data).toHaveLength(1);
    expect((await svc.from("trial_sessions").select("id").eq("is_demo", true)).data).toHaveLength(0);
    const audit = await svc.from("audit_log").select("reason, after").eq("action", "purge.demo");
    expect(audit.data?.some((a) => a.reason === REASON)).toBe(true);
    // the audit log itself and lineage of real projects are intact
    expect((await svc.from("lineage_events").select("id").eq("project_id", realProject)).data!.length).toBeGreaterThan(
      0,
    );
  });
});
