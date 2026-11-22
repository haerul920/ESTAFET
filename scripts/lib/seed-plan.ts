import { environmentName } from "../../src/lib/admin/env";

/**
 * Safety checks and the step plan for `pnpm seed:dev` (scripts/seed-dev.ts). Pure functions, unit tested in
 * tests/unit/seed-plan.test.ts. The script itself only runs what the plan says.
 */

type Env = Record<string, string | undefined>;

export type SeedTarget =
  | { kind: "local" }
  | { kind: "remote"; ref: string; dbUrl: string; host: string }
  | { kind: "refused"; reason: string };

const LOCAL = /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:|\/|$)/;

/** `https://<ref>.supabase.co` → `<ref>`. Anything else (custom domain, local) → null. */
export function refFromApiUrl(url: string | undefined): string | null {
  const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/i.exec(url?.trim() ?? "");
  return m ? m[1].toLowerCase() : null;
}

/**
 * The project ref inside a Postgres connection string: the pooler user `postgres.<ref>`
 * or the direct host `db.<ref>.supabase.co`. Null when neither is present.
 */
export function refFromDbUrl(dbUrl: string | undefined): string | null {
  let u: URL;
  try {
    u = new URL(dbUrl ?? "");
  } catch {
    return null;
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) return null;
  const user = decodeURIComponent(u.username);
  const fromUser = /^postgres\.([a-z0-9]{20})$/i.exec(user)?.[1];
  const fromHost = /^db\.([a-z0-9]{20})\.supabase\.co$/i.exec(u.hostname)?.[1];
  return (fromUser ?? fromHost)?.toLowerCase() ?? null;
}

/** Host and port only, for messages. Never the user or the password. */
export function describeDbUrl(dbUrl: string): string {
  try {
    const u = new URL(dbUrl);
    return `${u.hostname}:${u.port || "5432"}`;
  } catch {
    return "(unreadable database URL)";
  }
}

/**
 * Decides where the seeder may write.
 * - A local stack is handled by `pnpm db:reset`, which already seeds everything.
 * - A hosted project needs: APP_ENV LOCAL or DEMO (never STAGING or PRODUCTION; an unset APP_ENV with a hosted
 *   URL counts as PRODUCTION), SUPABASE_DB_URL for the SAME project as NEXT_PUBLIC_SUPABASE_URL, and explicit
 *   consent (`--yes` or ALLOW_REMOTE_SEED=true) unless it is a dry run.
 */
export function resolveSeedTarget(env: Env, opts: { yes: boolean; dryRun: boolean }): SeedTarget {
  const apiUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!apiUrl) return { kind: "refused", reason: "NEXT_PUBLIC_SUPABASE_URL is not set." };
  if (!(env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY))
    return { kind: "refused", reason: "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) is not set." };
  if (LOCAL.test(apiUrl)) return { kind: "local" };

  const name = environmentName(env);
  if (name !== "LOCAL" && name !== "DEMO")
    return {
      kind: "refused",
      reason:
        `APP_ENV is ${env.APP_ENV ? name : `not set, so this hosted project counts as ${name}`}. ` +
        "Demo data may only go into a development or demo project: set APP_ENV=LOCAL or APP_ENV=DEMO.",
    };

  const dbUrl = env.SUPABASE_DB_URL?.trim();
  if (!dbUrl)
    return {
      kind: "refused",
      reason:
        "SUPABASE_DB_URL is not set. Copy the Session pooler URI from the Supabase dashboard (Connect, port 5432), " +
        "put your database password in it, and add it to your env file.",
    };
  const apiRef = refFromApiUrl(apiUrl);
  const dbRef = refFromDbUrl(dbUrl);
  if (!apiRef || !dbRef)
    return {
      kind: "refused",
      reason: "Could not read the project ref from NEXT_PUBLIC_SUPABASE_URL or SUPABASE_DB_URL.",
    };
  if (apiRef !== dbRef)
    return {
      kind: "refused",
      reason: `SUPABASE_DB_URL points at another project (${dbRef.slice(0, 4)}…) than NEXT_PUBLIC_SUPABASE_URL (${apiRef.slice(0, 4)}…).`,
    };

  if (!opts.dryRun && !opts.yes && env.ALLOW_REMOTE_SEED !== "true")
    return {
      kind: "refused",
      reason: `This writes demo data to the hosted project ${apiRef.slice(0, 4)}…. Run again with --yes (or ALLOW_REMOTE_SEED=true) to confirm.`,
    };

  return { kind: "remote", ref: apiRef, dbUrl, host: describeDbUrl(dbUrl) };
}

export type SeedStep = "migrations" | "demo-sql" | "storage" | "demo-admin";

export interface SeedState {
  /** Demo projects already in the database (`projects.is_demo = true`). */
  demoProjects: number;
}

/**
 * The steps, in order. Migrations always run first (`db push` skips what is already applied).
 * The demo SQL runs only when no demo project exists, so a second run never duplicates rows;
 * after "Purge demo data" it runs again. Storage uploads use upsert, so they always run.
 */
export function planSeed(state: SeedState, env: Env): SeedStep[] {
  const steps: SeedStep[] = ["migrations"];
  if (state.demoProjects === 0) steps.push("demo-sql");
  steps.push("storage");
  if (env.SEED_DEMO === "true") steps.push("demo-admin");
  return steps;
}
