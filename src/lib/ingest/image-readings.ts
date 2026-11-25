import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readImage } from "@/lib/llm/vision";
import type { SynthesisConfig } from "@/lib/llm";
import { errorFields, log } from "@/lib/log";
import type { ProjectFile } from "@/lib/db/types";
import { imageForAi } from "./image";
import { LIMITS } from "./limits";
import { findSecretPatterns } from "./secrets-scan";
import type { ExtractedDoc } from "./types";

/** What to show beside a picture after the AI tried to read it. */
export type ReadingNote = "image_read" | "image_secret" | "image_unread";

const AT_ONCE = 3;
const TIMEOUT_MS = 30_000;

async function saveReading(file: ProjectFile, doc: ExtractedDoc, note: string, status: "ready" | "check") {
  const admin = createAdminClient();
  const saved = await admin.storage
    .from("extracted-text")
    .upload(file.extracted_text_path!, JSON.stringify(doc), { contentType: "application/json", upsert: true });
  if (saved.error) throw new Error("storage");
  await admin.from("project_files").update({ ingest_note: note, ingest_status: status }).eq("id", file.id);
}

/**
 * Has the AI read the pictures that have not been read yet, and keeps what it read. The CALLER must have checked that
 * every team member agreed. In mock mode nothing is read and nothing is made up. What the AI reads goes through the
 * secrets scan before it is kept or used.
 */
export async function readPendingImages(
  files: ProjectFile[],
  docs: Map<string, ExtractedDoc>,
  config: SynthesisConfig,
  note: (code: ReadingNote) => string,
): Promise<void> {
  const provider = config.provider;
  if (config.mode !== "live" || provider === "mock") return;
  const pending = files.filter((f) => f.kind === "image" && f.storage_path && !docs.get(f.id)?.pages[0]?.text);

  const readOne = async (file: ProjectFile) => {
    const doc = docs.get(file.id);
    if (!doc?.pages[0]) return;
    try {
      const stored = await createAdminClient().storage.from("project-files").download(file.storage_path!);
      if (stored.error || !stored.data) throw new Error("storage");
      const picture = await imageForAi(new Uint8Array(await stored.data.arrayBuffer()));
      const text = await readImage(provider, config.model, picture, AbortSignal.timeout(TIMEOUT_MS));
      if (findSecretPatterns(text, { loose: true }).length > 0) {
        await saveReading(file, doc, note("image_secret"), "check");
        return;
      }
      doc.pages[0].text = text.slice(0, LIMITS.textMaxChars);
      await saveReading(file, doc, note("image_read"), "ready");
    } catch (e) {
      // Never the picture or what was read from it: only what went wrong.
      log.warn("image_reading.failed", { fileId: file.id, ...errorFields(e) });
      await createAdminClient()
        .from("project_files")
        .update({ ingest_note: note("image_unread"), ingest_status: "check" })
        .eq("id", file.id);
    }
  };

  for (let start = 0; start < pending.length; start += AT_ONCE) {
    await Promise.all(pending.slice(start, start + AT_ONCE).map(readOne));
  }
}

/** When the owners take the AI back, what it read from pictures goes too. Returns false when something is left. */
export async function forgetImageReadings(projectId: string, note: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .eq("kind", "image");
  if (error) return false;
  try {
    for (const file of (data ?? []) as ProjectFile[]) {
      if (!file.extracted_text_path) continue;
      const empty: ExtractedDoc = {
        fileName: file.original_name,
        kind: "image",
        pages: [{ page: 1, label: "Image", text: "" }],
      };
      await saveReading(file, empty, note, "ready");
    }
    return true;
  } catch {
    return false;
  }
}
