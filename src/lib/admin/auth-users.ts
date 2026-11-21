import "server-only";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/supabase/keys";

/** What admins may know about a sign-in account beyond the profile: whether the email address is confirmed. */
export async function emailConfirmed(userId: string): Promise<boolean> {
  const { data } = await createAdminClient().auth.admin.getUserById(userId);
  return Boolean(data.user?.email_confirmed_at);
}

/** Sends the confirmation email again. Returns an error code (messages admin.errors.*) on failure, or null when it was sent. */
export async function sendConfirmationAgain(userId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().auth.admin.getUserById(userId);
  if (error || !data.user?.email) return "noEmail";
  if (data.user.email_confirmed_at) return "alreadyConfirmed";
  const plain = createPlainClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, { auth: { persistSession: false } });
  const sent = await plain.auth.resend({ type: "signup", email: data.user.email });
  return sent.error ? "sendFailed" : null;
}
