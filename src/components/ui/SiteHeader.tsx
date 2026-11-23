import { getCurrentUser, initials, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { GlassNav, type NavUser } from "./GlassNav";

/** Server wrapper: loads the signed-in user and the unread notification count for the nav. */
export async function SiteNav({ variant = "strip" }: { variant?: "hero" | "strip" }) {
  const user = await getCurrentUser();
  let navUser: NavUser | null = null;
  if (user) {
    const name = user.profile?.full_name || user.email;
    // Admins work in /admin only, so they get no dashboard, notifications or "share" entries.
    if (await isAdmin()) {
      navUser = { name, initials: initials(name), unread: 0, isAdmin: true };
    } else {
      const supabase = await createClient();
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);
      navUser = { name, initials: initials(name), unread: count ?? 0, isAdmin: false };
    }
  }
  return <GlassNav variant={variant} user={navUser} />;
}
