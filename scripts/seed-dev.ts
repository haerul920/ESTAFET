/**
 * `pnpm seed:dev` — fills a development or demo Supabase project with the labeled demo data in one command:
 *   1. applies pending migrations (supabase db push),
 *   2. runs supabase/seed.sql (3 demo accounts, 8 demo projects, items, requests, a demo report, demo trial rows),
 *      only when the project has no demo project yet,
 *   3. uploads the demo files to the private buckets (scripts/seed-storage.ts),
 *   4. creates the demo admin, only when SEED_DEMO=true (scripts/seed-admin.ts).
 *
 * Usage:  pnpm seed:dev -- --dry-run     show the target and the plan, write nothing
 *         pnpm seed:dev -- --yes         do it
 *
 * Safety (see scripts/lib/seed-plan.ts): APP_ENV must be LOCAL or DEMO, SUPABASE_DB_URL must belong to the same project
 * as NEXT_PUBLIC_SUPABASE_URL, and a hosted project needs --yes. The database password is never printed.
 * A local stack is seeded by `pnpm db:reset` instead.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { planSeed, resolveSeedTarget, type SeedStep } from "./lib/seed-plan";

// The seeder is for HOSTED projects, so it reads only .env.local and then .env. It deliberately does NOT read
// .env.localstack (the local stack, which `pnpm db:reset` seeds); see childEnv below for why that matters.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const yes = args.has("--yes");

const ROOT = process.cwd();
const SUPABASE_CLI = join(ROOT, "node_modules", "supabase", "dist", "supabase.js");
const TSX_CLI = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");

const CLEAR_SEED_RECORD =
  "do $$ begin if to_regclass('supabase_migrations.seed_files') is not null then " +
  "delete from supabase_migrations.seed_files where path like '%seed.sql'; end if; end $$";

const LABELS: Record<SeedStep, string> = {
  migrations: "Apply pending migrations (supabase db push)",
  "demo-sql": "Insert the demo data (supabase/seed.sql through db push --include-seed)",
  storage: "Upload the demo files to private Storage (seed-storage)",
  "demo-admin": "Create the demo admin admin@estafet.demo (SEED_DEMO=true)",
};

function fail(message: string, code = 1): never {
  console.error(`\nseed:dev stopped: ${message}`);
  process.exit(code);
}

/** Removes the database password (raw and URL-encoded) from any text before it is printed. */
function masker(dbUrl: string): (s: string) => string {
  let secret = "";
  try {
    secret = new URL(dbUrl).password;
  } catch {
    /* unreadable URL: nothing to mask, resolveSeedTarget already refused it */
  }
  const secrets = [secret, decodeURIComponent(secret), dbUrl].filter((s) => s.length >= 4);
  return (s) => secrets.reduce((acc, x) => acc.split(x).join("****"), s);
}

function run(label: string, cmd: string, cmdArgs: string[], mask: (s: string) => string, env = process.env): void {
  console.log(`\n→ ${label}`);
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = mask(`${r.stdout ?? ""}${r.stderr ?? ""}`)
    .split("\n")
    .filter((l) => l.trim() && !/^NOTICE|--db-url is deprecated/.test(l))
    .map((l) => `  ${l}`)
    .join("\n");
  if (out) console.log(out);
  if (r.error) fail(`${label}: ${mask(r.error.message)}`);
  if (r.status !== 0) fail(`${label} failed (exit code ${r.status}). Nothing after this step was run.`);
}

async function main() {
  const target = resolveSeedTarget(process.env, { yes, dryRun });
  if (target.kind === "refused") fail(target.reason, 3);
  if (target.kind === "local") {
    console.log(
      "The target is the local Supabase stack. Use `pnpm db:reset`: it applies the migrations and seeds everything.",
    );
    return;
  }
  for (const f of [SUPABASE_CLI, TSX_CLI]) if (!existsSync(f)) fail(`${f} is missing. Run pnpm install first.`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)!;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const mask = masker(target.dbUrl);

  // The current state decides whether the demo SQL runs. Before the first migration the table does not exist yet.
  // One retry: a short DNS or network hiccup shows up as "fetch failed".
  const readDemoCount = () => admin.from("projects").select("id", { count: "exact", head: true }).eq("is_demo", true);
  let { count, error } = await readDemoCount();
  if (error && /fetch failed/i.test(error.message)) ({ count, error } = await readDemoCount());
  const schemaMissing = Boolean(error && /does not exist|schema cache|404/i.test(`${error.message} ${error.code}`));
  if (error && !schemaMissing)
    fail(`could not read the projects table: ${error.message}. Check the network and NEXT_PUBLIC_SUPABASE_URL.`);
  const demoProjects = schemaMissing ? 0 : (count ?? 0);
  const steps = planSeed({ demoProjects }, process.env);

  console.log(`Target: hosted project ${target.ref.slice(0, 4)}… (${target.host}), APP_ENV=${process.env.APP_ENV}`);
  console.log(
    schemaMissing
      ? "State: no ESTAFET tables yet."
      : `State: ${demoProjects} demo project(s) already present${demoProjects ? ", so the demo SQL is skipped" : ""}.`,
  );
  console.log("Plan:");
  steps.forEach((s, i) => console.log(`  ${i + 1}. ${LABELS[s]}`));
  if (!steps.includes("demo-admin")) console.log("  (no demo admin: SEED_DEMO is not true)");

  if (dryRun) {
    run(
      "Pending migrations (dry run)",
      process.execPath,
      [SUPABASE_CLI, "db", "push", "--db-url", target.dbUrl, "--dry-run"],
      mask,
    );
    console.log("\nDry run only: nothing was written. Run `pnpm seed:dev -- --yes` to apply.");
    return;
  }

  // seed-storage and seed-admin load scripts/lib/env.ts, which reads .env.localstack first. dotenv never overrides
  // a variable that is already set, so every value they use is set here explicitly: otherwise a local key or
  // SEED_DEMO=true from .env.localstack could be mixed into a run against the hosted project.
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ALLOW_REMOTE_SEED: "true",
    NEXT_PUBLIC_SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: key,
    SUPABASE_SECRET_KEY: key,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    APP_ENV: process.env.APP_ENV ?? "",
    SEED_DEMO: process.env.SEED_DEMO === "true" ? "true" : "false",
  };
  for (const step of steps) {
    if (step === "migrations")
      run(LABELS[step], process.execPath, [SUPABASE_CLI, "db", "push", "--db-url", target.dbUrl, "--yes"], mask);
    if (step === "demo-sql") {
      // `db push --include-seed` runs the seed file (many statements, one connection) and records its hash, so it
      // would skip it next time. The plan only asks for this step when no demo project exists (first run, or after
      // "Purge demo data"), so the record is cleared first. `db query` takes one statement only, hence the DO block.
      run(
        "Clear the record of an earlier seed run",
        process.execPath,
        [SUPABASE_CLI, "db", "query", `--remote=${target.dbUrl}`, CLEAR_SEED_RECORD, "--yes"],
        mask,
      );
      run(
        LABELS[step],
        process.execPath,
        [SUPABASE_CLI, "db", "push", "--db-url", target.dbUrl, "--include-seed", "--yes"],
        mask,
      );
    }
    if (step === "storage") run(LABELS[step], process.execPath, [TSX_CLI, "scripts/seed-storage.ts"], mask, childEnv);
    if (step === "demo-admin") run(LABELS[step], process.execPath, [TSX_CLI, "scripts/seed-admin.ts"], mask, childEnv);
  }

  const after = await admin.from("projects").select("status").eq("is_demo", true);
  const byStatus = new Map<string, number>();
  for (const p of (after.data ?? []) as { status: string }[]) byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
  console.log(
    `\nDone. Demo projects: ${after.data?.length ?? 0} (${[...byStatus].map(([s, n]) => `${n} ${s}`).join(", ") || "none"}).`,
  );
  console.log("Demo accounts (password Demo-Pass-2026!, demo only): creator@, adopter@, alumni@estafet.demo.");
  console.log("Remove the demo rows later with Admin, Settings, Purge demo data. The demo accounts stay.");
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
