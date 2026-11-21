import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, pickSecretKey } from "./keys";

/**
 * Service-role client. Bypasses RLS, so it is used ONLY after an explicit authorization
 * check in server code (file upload, synthesis, signed URLs).
 * The key never reaches the browser: this module is server-only.
 */
export function createAdminClient() {
  return createSupabaseClient(
    SUPABASE_URL,
    pickSecretKey(process.env)!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
