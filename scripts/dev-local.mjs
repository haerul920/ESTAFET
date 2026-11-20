// Starts Next.js against the LOCAL Supabase stack on port 3100, using .env.localstack.
// Process env wins over .env.local, so a cloud project configured there is never used by this server.
import { spawn } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.localstack", quiet: true });
const child = spawn("pnpm", ["exec", "next", "dev", "-p", "3100"], { stdio: "inherit", shell: true, env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
