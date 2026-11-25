import { getCurrentUser, initials } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { avatarSrc } from "@/lib/account/avatar";
import { GlassNav, type NavUser } from "./GlassNav";

/** Server wrapper: loads the signed-in user and the unread notification count for the nav. */
export async function SiteNav({ variant = "strip" }: { variant?: "hero" | "strip" }) {
  const user = await getCurrentUser();
  let navUser: NavUser | null = null;
  if (user) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    const name = user.profile?.full_name || user.email;
    navUser = {
      name,
      initials: initials(name),
      unread: count ?? 0,
      photo: avatarSrc(user.id, user.profile?.avatar_url),
      isAdmin: user.profile?.is_admin === true,
    };
  }
  return <GlassNav variant={variant} user={navUser} />;
}
