import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Mirrors a suspension in Supabase Auth so a suspended user cannot sign in or refresh a session. */
export async function setAuthBan(userId: string, until: Date | null | "lift"): Promise<string | null> {
  const admin = createAdminClient();
  let ban_duration = "none";
  if (until instanceof Date) ban_duration = `${Math.max(1, Math.ceil((until.getTime() - Date.now()) / 3_600_000))}h`;
  else if (until === null) ban_duration = "876000h"; // about 100 years: until restored
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration });
  return error ? error.message : null;
}
