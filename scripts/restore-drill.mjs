// Restore drill: proves that a backup of the database can be restored and holds the same data.
//
//   pnpm restore:drill
//
// It works on the LOCAL Supabase stack only (the Docker container `supabase_db_estafet`):
//   1. dumps the schemas public, auth and storage (custom format, the same format a hosted `pg_dump` produces),
//   2. restores the dump into a scratch database `restore_drill`,
//   3. compares the number of rows of every table in `public` and of `auth.users` in both databases,
//   4. checks that the restored copy still has the security rules (row level security on, the audit trigger),
//   5. drops the scratch database.
// For a HOSTED project (staging or production) the steps are in docs/runbook.md, section "Restore".
import { execFileSync } from "node:child_process";

const CONTAINER = process.env.DB_CONTAINER ?? "supabase_db_estafet";
const SCRATCH = "restore_drill";

function docker(args, { allowFail = false } = {}) {
  try {
    return execFileSync("docker", ["exec", CONTAINER, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    if (allowFail) return `${e.stdout ?? ""}${e.stderr ?? ""}`;
    throw e;
  }
}
const psql = (db, sql) =>
  docker(["psql", "-U", "postgres", "-d", db, "-At", "-v", "ON_ERROR_STOP=1", "-c", sql]).trim();

function fail(message) {
  console.error(`\nRESTORE DRILL FAILED: ${message}`);
  psqlQuiet(`drop database if exists ${SCRATCH}`);
  process.exit(1);
}
function psqlQuiet(sql) {
  docker(["psql", "-U", "postgres", "-d", "postgres", "-c", sql], { allowFail: true });
}

try {
  docker(["pg_dump", "--version"]);
} catch {
  console.error(`Cannot reach the container "${CONTAINER}". Start the local stack first: pnpm db:start`);
  process.exit(2);
}

const started = Date.now();
console.log("1/5 dumping the database ...");
docker(["rm", "-f", "/tmp/drill.dump"], { allowFail: true });
// Only the schemas ESTAFET owns or depends on: our tables (public), the accounts (auth) and the file records (storage).
// Supabase's own internal schemas (realtime, vault, ...) are managed by Supabase and are not ours to restore.
docker([
  "pg_dump",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-Fc",
  "-n",
  "public",
  "-n",
  "auth",
  "-n",
  "storage",
  "-f",
  "/tmp/drill.dump",
]);
const size = docker(["sh", "-c", "wc -c < /tmp/drill.dump"]).trim();
console.log(`    dump written (${Math.round(Number(size) / 1024)} KB)`);

console.log("2/5 restoring into a scratch database ...");
psqlQuiet(`drop database if exists ${SCRATCH}`);
psql("postgres", `create database ${SCRATCH}`);
// pg_restore exits non-zero for harmless notices (extensions that already exist cluster wide). Count real errors instead.
const out = docker(
  ["pg_restore", "-U", "postgres", "-d", SCRATCH, "--no-owner", "--no-privileges", "/tmp/drill.dump"],
  { allowFail: true },
);
const errorLines = out.split("\n").filter((l) => /^pg_restore: error:/.test(l));
const harmless = (l) => /already exists|must be owner of|role .* does not exist|extension/i.test(l);
const real = errorLines.filter((l) => !harmless(l));
if (real.length) fail(`${real.length} restore error(s), first: ${real[0]}`);
console.log(`    restored (${errorLines.length} notice(s) about objects that already exist, 0 real errors)`);

console.log("3/5 comparing row counts ...");
const tables = psql(
  "postgres",
  "select table_schema || '.' || table_name from information_schema.tables where (table_schema = 'public' or (table_schema = 'auth' and table_name = 'users')) and table_type = 'BASE TABLE' order by 1",
)
  .split("\n")
  .filter(Boolean);
let mismatches = 0;
let rows = 0;
for (const t of tables) {
  const [schema, name] = t.split(".");
  const q = `select count(*) from "${schema}"."${name}"`;
  const a = Number(psql("postgres", q));
  const b = Number(psql(SCRATCH, q));
  rows += a;
  if (a !== b) {
    mismatches++;
    console.error(`    MISMATCH ${t}: original ${a}, restored ${b}`);
  }
}
if (mismatches) fail(`${mismatches} table(s) differ`);
console.log(`    ${tables.length} tables, ${rows} rows, all equal`);

console.log("4/5 checking the security rules survived ...");
const noRls = psql(
  SCRATCH,
  "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity",
);
if (Number(noRls) !== 0) fail(`${noRls} public table(s) lost row level security`);
const origNoRls = psql(
  "postgres",
  "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity",
);
if (noRls !== origNoRls) fail("row level security differs between the original and the restored copy");
const triggers = Number(
  psql(SCRATCH, "select count(*) from pg_trigger where not tgisinternal and tgrelid = 'public.audit_log'::regclass"),
);
if (triggers < 1) fail("the append-only trigger on audit_log is missing");
const policies = [
  psql("postgres", "select count(*) from pg_policies where schemaname = 'public'"),
  psql(SCRATCH, "select count(*) from pg_policies where schemaname = 'public'"),
];
if (policies[0] !== policies[1]) fail(`policy count differs (${policies[0]} vs ${policies[1]})`);
console.log(`    row level security intact, ${policies[1]} policies, audit trigger present`);

console.log("5/5 cleaning up ...");
psql("postgres", `drop database ${SCRATCH}`);
docker(["rm", "-f", "/tmp/drill.dump"], { allowFail: true });
console.log(`\nRESTORE DRILL PASSED in ${Math.round((Date.now() - started) / 1000)} s`);
