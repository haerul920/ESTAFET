import { config } from "dotenv";

/**
 * Local-first environment for scripts and tests. `.env.localstack` (the local Supabase stack) wins over
 * `.env.local` (which may point at a cloud project). Writing scripts refuse a non-local target unless
 * ALLOW_REMOTE_SEED=true, so a demo reset can never hit a real project by accident.
 */
config({ path: ".env.localstack", quiet: true });
config({ path: ".env.local", quiet: true });

export function isLocalTarget(url: string | undefined): boolean {
  return /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:|\/|$)/.test(url ?? "");
}

export function assertSafeTarget(what: string): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!isLocalTarget(url) && process.env.ALLOW_REMOTE_SEED !== "true") {
    console.error(
      `${what} refused: ${new URL(url ?? "http://unset").host} is not a local Supabase stack.\n` +
        "Create .env.localstack for the local stack, or set ALLOW_REMOTE_SEED=true if you really mean to write to that project.",
    );
    process.exit(3);
  }
}
