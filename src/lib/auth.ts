import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/db/types";

export interface CurrentUser {
  id: string;
  email: string;
  profile: Profile | null;
  /** True while a suspension is active (CLAUDE.md 13.4). Suspended users cannot act. */
  suspended: boolean;
}

export function isSuspendedProfile(p: Pick<Profile, "suspended_at" | "suspended_until"> | null | undefined, now = Date.now()): boolean {
  if (!p?.suspended_at) return false;
  return !p.suspended_until || new Date(p.suspended_until).getTime() > now;
}

/** The signed-in user (or null). Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const p = (profile as Profile | null) ?? null;
  return { id: user.id, email: user.email ?? "", profile: p, suspended: isSuspendedProfile(p) };
});

/** Redirects guests to the login page, then back to `next` after sign in. */
export async function requireUser(next: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (user.suspended) redirect("/suspended");
  return user;
}

export function initials(name: string | undefined | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}
