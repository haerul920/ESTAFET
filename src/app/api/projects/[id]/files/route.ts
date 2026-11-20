import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCreatorProject } from "@/lib/db/creator";
import { ingestUpload, UploadRejected } from "@/lib/ingest";
import { LIMITS } from "@/lib/ingest/limits";
import { getSettings, mbToBytes } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";

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

/** Uploads one or more files for a project the caller creates. Validates bytes, parses, stores privately. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload files." }, { status: 401 });
  if ((await getCurrentUser())?.suspended) return NextResponse.json({ error: "Your account is suspended." }, { status: 403 });
  const maxBytes = mbToBytes((await getSettings()).max_upload_mb.value);

  const project = await getCreatorProject(projectId);
  if (!project) return NextResponse.json({ error: "You can only upload files to your own projects." }, { status: 403 });
  if (!["draft", "awaiting_advisor", "verifying"].includes(project.status)) {
    return NextResponse.json({ error: "This project is published, so its files can no longer change." }, { status: 409 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload could not be read. Try a smaller file." }, { status: 400 });
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "Choose at least one file." }, { status: 400 });

  const { count } = await supabase.from("project_files").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  if ((count ?? 0) + files.length > LIMITS.maxFilesPerProject) {
    return NextResponse.json({ error: `A project can have at most ${LIMITS.maxFilesPerProject} files.` }, { status: 400 });
  }

  const admin = createAdminClient();
  const outcomes: UploadOutcome[] = [];

  for (const file of files) {
    if (file.size > maxBytes) {
      outcomes.push({ name: file.name, ok: false, note: `Larger than ${Math.round(maxBytes / 1024 / 1024)} MB, so it was not uploaded.` });
      continue;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await ingestUpload(file.name, bytes, { maxBytes });
      const fileId = crypto.randomUUID();
      let storagePath = "";
      let textPath: string | null = null;

      if (result.storeBytes && result.doc) {
        storagePath = `${projectId}/${fileId}-${safeName(result.storeName)}`;
        textPath = `${projectId}/${fileId}.json`;
        const up = await admin.storage.from("project-files").upload(storagePath, result.storeBytes, {
          contentType: result.kind === "pdf" ? "application/pdf" : result.kind === "markdown" ? "text/markdown" : "application/json",
          upsert: false,
        });
        if (up.error) throw new Error("storage");
        const tx = await admin.storage.from("extracted-text").upload(textPath, JSON.stringify(result.doc), {
          contentType: "application/json",
          upsert: false,
        });
        if (tx.error) {
          await admin.storage.from("project-files").remove([storagePath]);
          throw new Error("storage");
        }
      }

      const { error } = await admin.from("project_files").insert({
        id: fileId,
        project_id: projectId,
        kind: result.kind,
        storage_path: storagePath,
        original_name: file.name,
        size_bytes: file.size,
        page_count: result.pageCount,
        extracted_text_path: textPath,
        skipped_sensitive: result.skipped,
        ingest_status: result.status,
        ingest_note: result.note,
        created_by: user.id,
      });
      if (error) throw new Error("db");
      outcomes.push({ name: file.name, ok: true, status: result.status, note: result.note });
    } catch (e) {
      const message =
        e instanceof UploadRejected ? e.message : "Something went wrong while reading this file. Nothing was stored.";
      outcomes.push({ name: file.name, ok: false, note: message });
    }
  }

  return NextResponse.json({ outcomes });
}
