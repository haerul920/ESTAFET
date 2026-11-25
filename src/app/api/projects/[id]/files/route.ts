import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestUpload, UploadRejected } from "@/lib/ingest";
import { LIMITS } from "@/lib/ingest/limits";
import { scanUpload } from "@/lib/ingest/scan";
import { incomingFolder, openUpload } from "@/lib/ingest/upload-guard";
import { allow } from "@/lib/rate-limit";
import { errorFields, log } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "file";
}

interface UploadOutcome {
  name: string;
  ok: boolean;
  status?: "ready" | "check";
  note: string;
}

const body = z.object({
  uploads: z
    .array(z.object({ path: z.string().max(200), name: z.string().min(1).max(255) }))
    .min(1)
    .max(LIMITS.maxFilesPerProject),
});

/**
 * Step 2 of an upload: reads what the browser stored, checks the real bytes, reads the text and keeps the file in
 * private storage. The waiting copy is removed whatever the result, so a refused file does not stay.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const guard = await openUpload(request, projectId);
  if (!guard.ok) return guard.response;
  const { api, upload, maxBytes, maxMb } = guard;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: api("uploadNone") }, { status: 400 });
  // Only this project's waiting folder: a path from anywhere else is refused before anything is read.
  const waiting = new RegExp(`^${incomingFolder(projectId)}/[0-9a-f-]{36}$`, "i");
  if (!parsed.data.uploads.every((u) => waiting.test(u.path)))
    return NextResponse.json({ error: api("uploadUnreadable") }, { status: 400 });
  if (guard.fileCount + parsed.data.uploads.length > LIMITS.maxFilesPerProject) {
    return NextResponse.json({ error: api("uploadTooMany", { max: LIMITS.maxFilesPerProject }) }, { status: 400 });
  }
  if (!(await allow({ scope: "upload-finish", identity: guard.userId, max: 60, windowSeconds: 3600 })))
    return NextResponse.json({ error: api("uploadRateLimited") }, { status: 429 });

  const admin = createAdminClient();
  const originals = admin.storage.from("project-files");
  const texts = admin.storage.from("extracted-text");
  const outcomes: UploadOutcome[] = [];

  for (const { path, name } of parsed.data.uploads) {
    try {
      const stored = await originals.download(path);
      if (stored.error || !stored.data) {
        outcomes.push({ name, ok: false, note: upload("failed") });
        continue;
      }
      if (stored.data.size > maxBytes) {
        outcomes.push({ name, ok: false, note: upload("reject.too_big", { mb: maxMb }) });
        continue;
      }
      const bytes = new Uint8Array(await stored.data.arrayBuffer());
      if (!(await scanUpload(name, bytes)).clean) {
        outcomes.push({ name, ok: false, note: api("uploadScanRejected") });
        continue;
      }
      const result = await ingestUpload(name, bytes, { maxBytes });
      const note = upload(`note.${result.note.code}`, result.note.values);
      const fileId = crypto.randomUUID();
      let storagePath = "";
      let textPath: string | null = null;

      if (result.storeBytes && result.doc) {
        storagePath = `${projectId}/${fileId}-${safeName(result.storeName)}`;
        textPath = `${projectId}/${fileId}.json`;
        const up = await originals.upload(storagePath, result.storeBytes, {
          contentType: result.contentType,
          upsert: false,
        });
        if (up.error) throw new Error("storage");
        const tx = await texts.upload(textPath, JSON.stringify(result.doc), {
          contentType: "application/json",
          upsert: false,
        });
        if (tx.error) {
          await originals.remove([storagePath]);
          throw new Error("storage");
        }
      }

      const { error } = await admin.from("project_files").insert({
        id: fileId,
        project_id: projectId,
        kind: result.kind,
        storage_path: storagePath,
        original_name: name,
        size_bytes: result.storeBytes?.length ?? bytes.length,
        page_count: result.pageCount,
        extracted_text_path: textPath,
        skipped_sensitive: result.skipped,
        ingest_status: result.status,
        ingest_note: note,
        created_by: guard.userId,
      });
      if (error) {
        if (storagePath) await originals.remove([storagePath]);
        if (textPath) await texts.remove([textPath]);
        throw new Error("db");
      }
      outcomes.push({ name, ok: true, status: result.status, note });
    } catch (e) {
      if (e instanceof UploadRejected) {
        outcomes.push({ name, ok: false, note: upload(`reject.${e.code}`, e.values) });
      } else {
        // Never the file's name or content: only what went wrong.
        log.error("upload.failed", { projectId, ...errorFields(e) });
        outcomes.push({ name, ok: false, note: upload("failed") });
      }
    } finally {
      await originals.remove([path]);
    }
  }

  return NextResponse.json({ outcomes });
}
