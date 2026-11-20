export type UploadKind = "pdf" | "markdown" | "zip";

export class UploadRejected extends Error {}

function startsWith(buf: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

export function looksLikePdf(buf: Uint8Array): boolean {
  // The PDF header may be preceded by up to 1024 bytes of junk.
  const head = buf.subarray(0, 1024);
  for (let i = 0; i + 5 <= head.length; i++) {
    if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d], i)) return true; // %PDF-
  }
  return false;
}

export function looksLikeZip(buf: Uint8Array): boolean {
  return (
    startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) || // local file header
    startsWith(buf, [0x50, 0x4b, 0x05, 0x06]) // empty archive
  );
}

/** Markdown has no magic bytes: require valid UTF-8 text with no NUL bytes. */
export function looksLikeText(buf: Uint8Array): boolean {
  const sample = buf.subarray(0, 8192);
  if (sample.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, Math.min(buf.length, 1_000_000)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Decides what an upload really is from its bytes, then checks that the extension agrees.
 * Throws UploadRejected with a plain-language message otherwise.
 */
export function detectUploadKind(name: string, buf: Uint8Array): UploadKind {
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
  if (buf.length === 0) throw new UploadRejected("This file is empty.");

  if (ext === ".pdf") {
    if (!looksLikePdf(buf)) throw new UploadRejected("This file is named .pdf but its content is not a PDF.");
    return "pdf";
  }
  if (ext === ".zip") {
    if (!looksLikeZip(buf)) throw new UploadRejected("This file is named .zip but its content is not a ZIP archive.");
    return "zip";
  }
  if (ext === ".md" || ext === ".markdown") {
    if (looksLikePdf(buf) || looksLikeZip(buf) || !looksLikeText(buf)) {
      throw new UploadRejected("This file is named .md but its content is not Markdown text.");
    }
    return "markdown";
  }
  throw new UploadRejected("Only PDF reports, Markdown notes (.md) and ZIP archives are accepted.");
}
