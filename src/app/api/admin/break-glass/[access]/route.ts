import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Emergency (break glass) file link. The database function checks that the caller is an admin, that the
 * access belongs to them and has not expired. The signed URL lives for the time left, at most 5 minutes.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ access: string }> }) {
  const { access } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_break_glass_get", { p_access: access });
  if (error || !data)
    return NextResponse.json(
      { error: error?.message ?? "Not found" },
      { status: error && /expired/i.test(error.message) ? 410 : 404 },
    );
  const info = data as { storage_path: string; file_name: string; expires_at: string };
  const seconds = Math.max(5, Math.min(300, Math.floor((new Date(info.expires_at).getTime() - Date.now()) / 1000)));
  const { data: signed, error: signError } = await createAdminClient()
    .storage.from("project-files")
    .createSignedUrl(info.storage_path, seconds, { download: info.file_name });
  if (signError || !signed) return NextResponse.json({ error: "Could not prepare the file." }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, 302);
}
