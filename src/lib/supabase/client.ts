import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, sessionCookieOptions } from "./keys";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, { cookieOptions: sessionCookieOptions() });
}
