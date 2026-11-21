// Builds and serves a PRODUCTION build against the LOCAL Supabase stack on port 3200 (for performance checks).
// Usage: node scripts/prod-local.mjs        then, in another terminal: E2E_BASE_URL=http://localhost:3200 pnpm perf
// It uses .env.localstack, keeps the demo data and mock AI (APP_ENV stays LOCAL), and writes to .next-perf so a running dev server is untouched.
import { spawnSync, spawn } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.localstack", quiet: true });
const env = { ...process.env, NEXT_DIST_DIR: ".next-perf" };

const build = spawnSync("pnpm", ["exec", "next", "build"], { stdio: "inherit", shell: true, env });
if (build.status !== 0) process.exit(build.status ?? 1);

const server = spawn("pnpm", ["exec", "next", "start", "-p", "3200"], { stdio: "inherit", shell: true, env });
server.on("exit", (code) => process.exit(code ?? 0));
