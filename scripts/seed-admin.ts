/**
 * Creates ONE demo admin account, and only when SEED_DEMO=true. Production never seeds an admin.
 * Credentials are documented as DEMO ONLY in the README. Real admins are promoted with promote_admin().
 */
import { assertSafeTarget } from "./lib/env";
import { createClient } from "@supabase/supabase-js";

if (process.env.SEED_DEMO !== "true") {
  console.log("SEED_DEMO is not true: no demo admin was created.");
  process.exit(0);
}
assertSafeTarget("seed:admin");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see scripts/lib/env.ts).");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const EMAIL = "admin@estafet.demo";

async function main() {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let id = list?.users.find((u) => u.email === EMAIL)?.id;
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: "Demo-Pass-2026!",
      email_confirm: true,
      user_metadata: { full_name: "Demo Admin", faculty: "Engineering" },
    });
    if (error) throw error;
    id = data.user.id;
  }
  const { error } = await admin.rpc("promote_admin", { p_email: EMAIL });
  if (error) throw error;
  console.log(`Demo admin ready: ${EMAIL} (demo only).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
