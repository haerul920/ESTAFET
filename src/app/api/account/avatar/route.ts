import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AVATAR_BUCKET, ownAvatarPath } from "@/lib/account/avatar";

/** The signed-in person's own profile photo. There is no way to ask for anyone else's. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.suspended) return new NextResponse(null, { status: 401 });
  const path = ownAvatarPath(user.id, user.profile?.avatar_url);
  if (!path) return new NextResponse(null, { status: 404 });
  const { data, error } = await createAdminClient().storage.from(AVATAR_BUCKET).download(path);
  if (error || !data) return new NextResponse(null, { status: 404 });
  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      // Private to this browser. A new photo gets a new address, so a long cache is safe.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
