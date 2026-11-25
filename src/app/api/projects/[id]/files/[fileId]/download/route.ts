import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { apiLocale } from "@/i18n/api";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
const PREVIEW_SECONDS = 300;

/**
 * Private file download. The signed-in user's own client reads the file row first: RLS only returns
 * it to creators and to adopters whose request is approved and agreement accepted by both sides.
 * Only then does the server mint a short-lived signed URL.
 *
 * `?preview=1` (PDF only) answers with the address as JSON, without the download flag, so the page can show the file
 * in its viewer. The access check is the same. Other file types are never served for display.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  const locale = apiLocale(req);
  const api = await getTranslations({ locale, namespace: "api" });
  const errs = await getTranslations({ locale, namespace: "errors" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: errs("signIn") }, { status: 401 });
  if ((await getCurrentUser())?.suspended) return NextResponse.json({ error: errs("suspended") }, { status: 403 });

  const { data: file } = await supabase
    .from("project_files")
    .select("storage_path, original_name, kind")
    .eq("id", fileId)
    .eq("project_id", id)
    .maybeSingle();
  if (!file || !file.storage_path) return NextResponse.json({ error: api("downloadNoAccess") }, { status: 403 });

  const preview = new URL(req.url).searchParams.get("preview") === "1";
  if (preview && file.kind !== "pdf") return NextResponse.json({ error: api("downloadNoAccess") }, { status: 400 });

  const downloadName =
    file.kind === "code_tree" ? file.original_name.replace(/\.zip$/i, "") + ".tree.json" : file.original_name;
  const admin = createAdminClient();
  // A viewer may still be reading a large file a while after it opened, so a preview address lives a little longer.
  const { data, error } = await admin.storage
    .from("project-files")
    .createSignedUrl(
      file.storage_path,
      preview ? PREVIEW_SECONDS : 60,
      preview ? undefined : { download: downloadName },
    );
  if (error || !data) return NextResponse.json({ error: api("downloadFailed") }, { status: 500 });
  if (preview) return NextResponse.json({ url: data.signedUrl }, { headers: { "cache-control": "no-store" } });
  return NextResponse.redirect(data.signedUrl, 302);
}
