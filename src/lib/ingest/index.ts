import { maxUploadBytes } from "./limits";
import { detectUploadKind, UploadRejected } from "./magic";
import { parseMarkdownSections } from "./markdown";
import { extractPdfPages } from "./pdf";
import { findSecretPatterns, type SkippedFile } from "./secrets-scan";
import { readZipTree, zipTreeToPages } from "./zip-tree";
import type { ExtractedDoc } from "./types";

export type { ExtractedDoc, ExtractedPage } from "./types";
export { UploadRejected } from "./magic";

export interface IngestResult {
  kind: "pdf" | "markdown" | "code_tree";
  doc: ExtractedDoc | null;
  pageCount: number | null;
  skipped: SkippedFile[];
  status: "ready" | "check";
  /** Plain-language explanation shown next to the file ("Text extracted from 18 pages."). */
  note: string;
  /** Bytes to put in private storage. For ZIPs this is a sanitized tree, never the original archive. */
  storeBytes: Uint8Array | null;
  storeName: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Validates (magic bytes, size) and parses one uploaded file. Never executes anything. */
export async function ingestUpload(name: string, data: Uint8Array, opts: { maxBytes?: number } = {}): Promise<IngestResult> {
  const limit = opts.maxBytes ?? maxUploadBytes();
  if (data.length > limit) {
    throw new UploadRejected(`This file is larger than ${Math.round(limit / 1024 / 1024)} MB.`);
  }
  const kind = detectUploadKind(name, data);

  if (kind === "pdf") {
    const pages = await extractPdfPages(data);
    const hits = findSecretPatterns(pages.map((p) => p.text).join("\n"));
    if (hits.length > 0) {
      return {
        kind: "pdf",
        doc: null,
        pageCount: pages.length,
        skipped: [{ name, reason: `Looks like it contains a secret (${hits[0].rule})` }],
        status: "check",
        note: "Skipped and not stored. The text looks like it contains a secret or token. Remove it and upload again.",
        storeBytes: null,
        storeName: name,
      };
    }
    const empty = pages.every((p) => p.text.length === 0);
    return {
      kind: "pdf",
      doc: { fileName: name, kind: "pdf", pages },
      pageCount: pages.length,
      skipped: [],
      status: empty ? "check" : "ready",
      note: empty
        ? "No text found. This may be a scanned PDF, which ESTAFET cannot read yet."
        : `Text extracted from ${plural(pages.length, "page", "pages")}.`,
      storeBytes: data,
      storeName: name,
    };
  }

  if (kind === "markdown") {
    const text = new TextDecoder("utf-8").decode(data);
    const hits = findSecretPatterns(text, { loose: true });
    if (hits.length > 0) {
      return {
        kind: "markdown",
        doc: null,
        pageCount: null,
        skipped: [{ name, reason: `Looks like it contains a secret (${hits[0].rule}, line ${hits[0].line})` }],
        status: "check",
        note: `Skipped and not stored. Line ${hits[0].line} looks like a secret or token. Remove it and upload again.`,
        storeBytes: null,
        storeName: name,
      };
    }
    const pages = parseMarkdownSections(text);
    return {
      kind: "markdown",
      doc: { fileName: name, kind: "markdown", pages },
      pageCount: pages.length,
      skipped: [],
      status: "ready",
      note: `Parsed ${plural(pages.length, "section", "sections")}.`,
      storeBytes: data,
      storeName: name,
    };
  }

  const tree = await readZipTree(data);
  const pages = zipTreeToPages(tree);
  const sanitized = new TextEncoder().encode(JSON.stringify({ tree: tree.tree, readme: tree.readme, manifests: tree.manifests }));
  const skippedNames = tree.skipped.map((s) => s.name.split("/").pop());
  const noteParts = [`Mapped ${plural(tree.fileCount, "file", "files")}.`];
  if (tree.skipped.length > 0) {
    noteParts.push(
      `${plural(tree.skipped.length, "sensitive file was", "sensitive files were")} skipped and not stored (${skippedNames.join(", ")}).`,
    );
  }
  noteParts.push("Only the README and package manifests are read.");
  return {
    kind: "code_tree",
    doc: { fileName: name, kind: "code_tree", pages },
    pageCount: null,
    skipped: tree.skipped,
    status: tree.skipped.length > 0 ? "check" : "ready",
    note: noteParts.join(" "),
    storeBytes: sanitized,
    storeName: name.replace(/\.zip$/i, "") + ".tree.json",
  };
}
