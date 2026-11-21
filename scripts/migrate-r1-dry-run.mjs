// R1 migration dry run. Resets the LOCAL database to the PRE-R1 schema, loads the old seed plus extra legacy rows,
// applies the R1 migrations, checks the invariants from docs/migrations-r1.md, then restores the normal local database.
// Run: node scripts/migrate-r1-dry-run.mjs   (needs the local Supabase stack; it only ever touches the local container)
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CONTAINER = "supabase_db_estafet";
const PRE_R1 = "20261120000001";
const shell = process.platform === "win32";
const pnpm = (args) => execFileSync("pnpm", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell });
const psql = (sql) =>
  execFileSync("docker", ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], {
    encoding: "utf8",
    input: sql,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
const num = (sql) => Number(psql(sql));

const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures.push(name);
};

try {
  console.log("1. Reset to the pre-R1 schema (no seed)");
  pnpm(["exec", "supabase", "db", "reset", "--version", PRE_R1, "--no-seed"]);
  console.log("2. Load the legacy seed and extra legacy rows");
  psql(readFileSync("supabase/dry-run/legacy-seed.sql", "utf8"));
  psql(readFileSync("supabase/dry-run/legacy-extra.sql", "utf8"));

  const before = {
    projects: num("select count(*) from public.projects"),
    lineage: num("select count(*) from public.lineage_events"),
    members: num("select count(*) from public.project_members"),
    adopters: num("select count(*) from public.project_members where role = 'adopter'"),
    publicProjects: num("select count(*) from public.public_project_teaser"),
    requests: num("select count(*) from public.continuation_requests"),
  };
  console.log("   before:", JSON.stringify(before));

  console.log("3. Apply the R1 migrations");
  pnpm(["exec", "supabase", "migration", "up"]);

  console.log("4. Invariants");
  check("project count unchanged", num("select count(*) from public.projects") === before.projects);
  check("lineage rows unchanged (append-only, untouched)", num("select count(*) from public.lineage_events") === before.lineage);
  check("request rows unchanged", num("select count(*) from public.continuation_requests") === before.requests);
  check("every project has exactly one owner", num("select count(*) from public.projects p where (select count(*) from public.project_members m where m.project_id = p.id and m.role = 'owner') <> 1") === 0);
  check("the owner is the original creator", num("select count(*) from public.project_members m join public.projects p on p.id = m.project_id where m.role = 'owner' and m.profile_id <> p.created_by") === 0);
  check("the second creator became a co_owner", num("select count(*) from public.project_members where project_id = 'b0000000-0000-4000-8000-000000000001' and profile_id = 'd0000000-0000-4000-8000-000000000001' and role = 'co_owner' and status = 'active'") === 1);
  check("no adopter rows remain in project_members", num("select count(*) from public.project_members") === before.members - before.adopters);
  check("a signed, unlocked request became one access row per person who accepted", num("select count(*) from public.project_access where request_id = 'e0000000-0000-4000-8000-000000000002' and status = 'active' and source = 'approved_request'") === 2);
  check("a half-signed request created no access", num("select count(*) from public.project_access where request_id = 'e0000000-0000-4000-8000-000000000001'") === 0);
  check("the two people from one team count as one team", num("select public.active_adopter_count('b0000000-0000-4000-8000-000000000003')") === 1);
  check("adopted became published", psql("select status from public.projects where id = 'b0000000-0000-4000-8000-000000000003'") === "published");
  check("awaiting_advisor and verifying became draft", num("select count(*) from public.projects where status = 'draft'") === 2);
  check("the public teaser shows the same projects as before", num("select count(*) from public.public_project_teaser") === before.publicProjects);
  check("migrated projects keep today's behaviour (by_request, limit 3)", num("select count(*) from public.projects where access_mode = 'by_request' and max_active_adopters = 3") === before.projects);
  check("old pending requests got a fresh expiry window", num("select count(*) from public.continuation_requests where status = 'pending' and expires_at > now() + interval '29 days'") === num("select count(*) from public.continuation_requests where status = 'pending'"));
  check("backups hold the pre-R1 rows", num("select count(*) from r1_backup.project_members") === before.members && num("select count(*) from r1_backup.projects_status") === before.projects);
  check("the backup schema is not reachable by API roles", num("select count(*) from information_schema.table_privileges where table_schema = 'r1_backup' and grantee in ('anon', 'authenticated')") === 0);
  check("the old status values are gone", num("select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'project_status' and e.enumlabel in ('adopted', 'verifying', 'awaiting_advisor')") === 0);
  check("no policy acceptance was invented for migrated users", num("select count(*) from public.policy_acceptances") === 0);
} catch (e) {
  console.error(String(e.stderr ?? e.message ?? e));
  failures.push("script error");
} finally {
  console.log("5. Restore the normal local database (pnpm db:reset)");
  const r = spawnSync("pnpm", ["db:reset"], { stdio: "ignore", shell });
  console.log(r.status === 0 ? "   restored" : "   RESTORE FAILED: run `pnpm db:reset` yourself");
}

if (failures.length) {
  console.error(`\nDry run FAILED: ${failures.join("; ")}`);
  process.exit(1);
}
console.log("\nDry run passed.");
