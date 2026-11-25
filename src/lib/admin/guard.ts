import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { REAUTH_COOKIE, REAUTH_MINUTES, verifyReauth } from "./reauth";

/** Asks the database (is_admin()), never a client flag. */
const isAdminUser = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_admin");
  return data === true;
});

/** Non-admins and guests get 404, not 403, so the area is not advertised. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !(await isAdminUser())) notFound();
  return user;
}

async function hasRecentAuth(userId: string, minutes: number = REAUTH_MINUTES): Promise<boolean> {
  const store = await cookies();
  return verifyReauth(store.get(REAUTH_COOKIE)?.value, userId, minutes);
}

export class ReauthRequired extends Error {
  constructor() {
    super("Confirm your password to continue.");
  }
}

/** For sensitive actions (suspend, remove, break glass, settings, purge). Throws ReauthRequired. */
export async function requireRecentAuth(minutes: number = REAUTH_MINUTES): Promise<CurrentUser> {
  const user = await requireAdmin();
  if (!(await hasRecentAuth(user.id, minutes))) throw new ReauthRequired();
  return user;
}
