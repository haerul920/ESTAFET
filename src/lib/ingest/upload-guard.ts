import "server-only";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { apiLocale } from "@/i18n/api";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getOwnedProject } from "@/lib/db/owner";
import { getSettings, mbToBytes } from "@/lib/settings";
import { HARD_MAX_UPLOAD_MB } from "./accept";

/** Who may add files to a project. Both upload routes ask this first. */
export async function openUpload(request: Request, projectId: string) {
  const locale = apiLocale(request);
  const [api, errors, upload] = await Promise.all([
    getTranslations({ locale, namespace: "api" }),
    getTranslations({ locale, namespace: "errors" }),
    getTranslations({ locale, namespace: "upload" }),
  ]);
  const refuse = (error: string, status: number) => ({
    ok: false as const,
    response: NextResponse.json({ error }, { status }),
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return refuse(api("uploadSignIn"), 401);
  if ((await getCurrentUser())?.suspended) return refuse(errors("suspended"), 403);
  const project = await getOwnedProject(projectId);
  if (!project) return refuse(api("uploadNotOwner"), 403);
  if (!["draft", "unpublished"].includes(project.status)) return refuse(api("uploadPublished"), 409);

  const maxMb = Math.min((await getSettings()).max_upload_mb.value, HARD_MAX_UPLOAD_MB);
  const { count } = await supabase
    .from("project_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  return {
    ok: true as const,
    userId: user.id,
    maxBytes: mbToBytes(maxMb),
    maxMb,
    fileCount: count ?? 0,
    api,
    upload,
  };
}

/** Where a file waits between the browser's upload and the server's checks. */
export const incomingFolder = (projectId: string) => `${projectId}/incoming`;
