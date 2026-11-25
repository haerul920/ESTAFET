import { checkName, extensionOf, type UploadKind } from "./accept";

export type { UploadKind } from "./accept";

/** Why a file was refused. The upload route turns the code into the person's language (`upload.reject.<code>`). */
export type RejectCode =
  | "empty"
  | "type"
  | "zip"
  | "old_office"
  | "mismatch"
  | "too_big"
  | "pdf_broken"
  | "pdf_pages"
  | "office_broken"
  | "office_unsafe"
  | "office_macros"
  | "image_broken"
  | "image_too_large";

export class UploadRejected extends Error {
  constructor(
    readonly code: RejectCode,
    readonly values: Record<string, string | number> = {},
  ) {
    super(code);
    this.name = "UploadRejected";
  }
}

function startsWith(buf: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function looksLikePdf(buf: Uint8Array): boolean {
  // The PDF header may be preceded by up to 1024 bytes of junk.
  const head = buf.subarray(0, 1024);
  for (let i = 0; i + 5 <= head.length; i++) {
    if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d], i)) return true; // %PDF-
  }
  return false;
}

/** Word, Excel and PowerPoint files are ZIP containers. What is inside is checked when they are read. */
const looksLikeZipContainer = (buf: Uint8Array) => startsWith(buf, [0x50, 0x4b, 0x03, 0x04]);

const looksLikeJpeg = (buf: Uint8Array) => startsWith(buf, [0xff, 0xd8, 0xff]);
const looksLikePng = (buf: Uint8Array) => startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Markdown has no magic bytes: require valid UTF-8 text with no NUL bytes. */
function looksLikeText(buf: Uint8Array): boolean {
  const sample = buf.subarray(0, 8192);
  if (sample.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, Math.min(buf.length, 1_000_000)));
    return true;
  } catch {
    return false;
  }
}

function contentMatches(kind: UploadKind, ext: string, buf: Uint8Array): boolean {
  if (kind === "pdf") return looksLikePdf(buf);
  if (kind === "image") return ext === ".png" ? looksLikePng(buf) : looksLikeJpeg(buf);
  if (kind === "markdown") return !looksLikePdf(buf) && !looksLikeZipContainer(buf) && looksLikeText(buf);
  return looksLikeZipContainer(buf);
}

/**
 * Decides what an upload really is: the extension names it and the first bytes have to agree.
 * Throws UploadRejected otherwise.
 */
export function detectUploadKind(name: string, buf: Uint8Array): UploadKind {
  const named = checkName(name);
  if (!named.ok) throw new UploadRejected(named.code);
  if (buf.length === 0) throw new UploadRejected("empty");
  const ext = extensionOf(name);
  if (!contentMatches(named.kind, ext, buf)) throw new UploadRejected("mismatch", { ext });
  return named.kind;
}
