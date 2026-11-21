import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS, so it is used ONLY after an explicit authorization
 * check in server code (file upload, synthesis, signed URLs).
 * The key never reaches the browser: this module is server-only.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
