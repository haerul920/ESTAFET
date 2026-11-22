/**
 * Finishes every account deletion whose 30 day grace period is over. Run it once a day (a scheduler is part of R7).
 *
 *   pnpm deletions:process
 *
 * It uses the service role key, so it acts on whatever project NEXT_PUBLIC_SUPABASE_URL points to. It prints account ids
 * only: never emails, names or file names.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { processDueDeletions, type DeletionClient } from "../src/lib/account/deletion";

config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const results = await processDueDeletions(db as unknown as DeletionClient);
if (results.length === 0) console.log("No account deletions are due.");
for (const r of results) {
  console.log(
    r.ok
      ? `done ${r.profileId}: ${r.draftsDeleted} draft project(s), ${r.filesRemoved} file(s) removed`
      : `FAILED ${r.profileId}: ${r.error} (the database step ran; finish the cleanup by hand)`,
  );
}
process.exit(results.some((r) => !r.ok) ? 1 : 0);
