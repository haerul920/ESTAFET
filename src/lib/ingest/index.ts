import { extractOffice } from "./office";
import { checkImage } from "./image";
import { LIMITS, maxUploadBytes } from "./limits";
import { detectUploadKind, UploadRejected, type UploadKind } from "./magic";
import { parseMarkdownSections } from "./markdown";
import { extractPdfPages } from "./pdf";
import { findSecretPatterns, type SkippedFile } from "./secrets-scan";
import type { ExtractedDoc, ExtractedPage } from "./types";

export type { ExtractedDoc, ExtractedPage } from "./types";
export { UploadRejected } from "./magic";

/** What happened to a file. The upload route turns the code into the person's language (`upload.note.<code>`). */
export interface IngestNote {
  code: "pdf" | "pdf_scanned" | "markdown" | "word" | "spreadsheet" | "slides" | "no_text" | "image" | "secret";
  values?: Record<string, string | number>;
}

export interface IngestResult {
  kind: UploadKind;
  doc: ExtractedDoc | null;
  pageCount: number | null;
  skipped: SkippedFile[];
  status: "ready" | "check";
  note: IngestNote;
  /** Bytes to put in private storage. Null when the file must not be kept. */
  storeBytes: Uint8Array | null;
  storeName: string;
  contentType: string;
}

const CONTENT_TYPES = {
  pdf: "application/pdf",
  markdown: "text/markdown",
  word: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  spreadsheet: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  slides: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

/** Reads the text of a file that has text, and says how to describe the result. */
async function readText(
  kind: Exclude<UploadKind, "image">,
  data: Uint8Array,
): Promise<{ pages: ExtractedPage[]; note: IngestNote; status: "ready" | "check" }> {
  let pages: ExtractedPage[];
  if (kind === "pdf") pages = await extractPdfPages(data);
  else if (kind === "markdown")
    pages = parseMarkdownSections(new TextDecoder("utf-8").decode(data).slice(0, LIMITS.textMaxChars));
  else pages = await extractOffice(kind, data);
  if (pages.every((p) => p.text.trim().length === 0))
    return { pages, note: { code: kind === "pdf" ? "pdf_scanned" : "no_text" }, status: "check" };
  return { pages, note: { code: kind, values: { count: pages.length } }, status: "ready" };
}

/** Validates (size, magic bytes, structure) and reads one uploaded file. Never executes anything. */
export async function ingestUpload(
  name: string,
  data: Uint8Array,
  opts: { maxBytes?: number } = {},
): Promise<IngestResult> {
  const limit = opts.maxBytes ?? maxUploadBytes();
  const tooBig = () => new UploadRejected("too_big", { mb: Math.round(limit / 1024 / 1024) });
  if (data.length > limit) throw tooBig();
  const kind = detectUploadKind(name, data);

  if (kind === "image") {
    // A picture has no text yet. The AI reads it when a draft is made, after the whole team agreed. Never at upload.
    const image = await checkImage(data);
    if (image.bytes.length > limit) throw tooBig();
    return {
      kind,
      doc: { fileName: name, kind, pages: [{ page: 1, label: "Image", text: "" }] },
      pageCount: null,
      skipped: [],
      status: "ready",
      note: { code: "image", values: { width: image.width, height: image.height } },
      storeBytes: image.bytes,
      storeName: name,
      contentType: image.contentType,
    };
  }

  const { pages, note, status } = await readText(kind, data);
  // Every document is scanned. PDFs use the high confidence rules only, so ordinary prose is not flagged.
  const hits = findSecretPatterns(pages.map((p) => p.text).join("\n"), { loose: kind !== "pdf" });
  if (hits.length > 0) {
    return {
      kind,
      doc: null,
      pageCount: null,
      skipped: [{ name, reason: `Looks like it contains a secret (${hits[0].rule})` }],
      status: "check",
      note: { code: "secret", values: { rule: hits[0].rule } },
      storeBytes: null,
      storeName: name,
      contentType: CONTENT_TYPES[kind],
    };
  }
  return {
    kind,
    doc: { fileName: name, kind, pages },
    pageCount: pages.length,
    skipped: [],
    status,
    note,
    storeBytes: data,
    storeName: name,
    contentType: CONTENT_TYPES[kind],
  };
}
