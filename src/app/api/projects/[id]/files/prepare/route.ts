import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkName } from "@/lib/ingest/accept";
import { LIMITS } from "@/lib/ingest/limits";
import { incomingFolder, openUpload } from "@/lib/ingest/upload-guard";
import { allow } from "@/lib/rate-limit";

export const runtime = "nodejs";

const body = z.object({
  files: z
    .array(z.object({ name: z.string().min(1).max(255), size: z.number().int().nonnegative() }))
    .min(1)
    .max(LIMITS.maxFilesPerProject),
});

const ABANDONED_AFTER_MS = 60 * 60 * 1000;

/** Removes uploads that were started and never finished. */
async function clearAbandoned(projectId: string) {
  const bucket = createAdminClient().storage.from("project-files");
  const { data } = await bucket.list(incomingFolder(projectId), { limit: 100 });
  const old = (data ?? [])
    .filter((o) => o.created_at && Date.now() - new Date(o.created_at).getTime() > ABANDONED_AFTER_MS)
    .map((o) => `${incomingFolder(projectId)}/${o.name}`);
  if (old.length) await bucket.remove(old);
}

/**
 * Step 1 of an upload. Files go from the browser straight to storage, because a serverless request cannot carry a
 * large file. This checks who asks and what they want to send, and hands out one single-use address per file.
 * Nothing is trusted yet: the finishing step reads the stored bytes and checks them.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const guard = await openUpload(request, projectId);
  if (!guard.ok) return guard.response;
  const { api, upload } = guard;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: api("uploadNone") }, { status: 400 });
  const wanted = parsed.data.files;
  if (guard.fileCount + wanted.length > LIMITS.maxFilesPerProject) {
    return NextResponse.json({ error: api("uploadTooMany", { max: LIMITS.maxFilesPerProject }) }, { status: 400 });
  }
  // 30 upload requests per hour per account. A person preparing a project stays far below this.
  if (!(await allow({ scope: "upload", identity: guard.userId, max: 30, windowSeconds: 3600 })))
    return NextResponse.json({ error: api("uploadRateLimited") }, { status: 429 });

  await clearAbandoned(projectId);
  const bucket = createAdminClient().storage.from("project-files");
  const tickets = await Promise.all(
    wanted.map(async (file) => {
      const named = checkName(file.name);
      if (!named.ok) return { name: file.name, error: upload(`reject.${named.code}`) };
      if (file.size === 0) return { name: file.name, error: upload("reject.empty") };
      if (file.size > guard.maxBytes) return { name: file.name, error: upload("reject.too_big", { mb: guard.maxMb }) };
      const path = `${incomingFolder(projectId)}/${crypto.randomUUID()}`;
      const { data, error } = await bucket.createSignedUploadUrl(path);
      if (error || !data) return { name: file.name, error: upload("failed") };
      return { name: file.name, path, token: data.token };
    }),
  );
  return NextResponse.json({ tickets });
}
