// Starts Next.js against the LOCAL Supabase stack on port 3100, using .env.localstack.
// Process env wins over .env.local, so a cloud project configured there is never used by this server.
import { spawn } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.localstack", quiet: true });
// Browser tests sign up and sign in much faster and more often than people. Honoured only by a LOCAL server.
process.env.RATE_LIMIT_MULTIPLIER ??= "1000";
// The scheduled-job routes need a secret, and emails only print a line. Both are for this local server only.
process.env.CRON_SECRET ??= "local-only-cron-secret-0123456789-abcdefghij";
process.env.EMAIL_PROVIDER ??= "log";
const child = spawn("pnpm", ["exec", "next", "dev", "-p", "3100"], { stdio: "inherit", shell: true, env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
