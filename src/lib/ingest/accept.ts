/** Which files can be uploaded. No Node imports: the browser and the server share these rules. */
export type UploadKind = "pdf" | "markdown" | "image" | "word" | "spreadsheet" | "slides";

const BY_EXTENSION: Record<string, UploadKind> = {
  ".pdf": "pdf",
  ".md": "markdown",
  ".markdown": "markdown",
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".docx": "word",
  ".xlsx": "spreadsheet",
  ".pptx": "slides",
};

/** The old Office formats. They cannot be read reliably, so people are asked to save them in the new format. */
const OLD_OFFICE = new Set([".doc", ".xls", ".ppt"]);

/** For the file picker. */
export const ACCEPT_ATTRIBUTE = Object.keys(BY_EXTENSION).join(",");

/** The upload limit of the private storage bucket. A larger setting could not be honoured. */
export const HARD_MAX_UPLOAD_MB = 50;

export function extensionOf(name: string): string {
  const lower = name.toLowerCase();
  return lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
}

export type NameCheck = { ok: true; kind: UploadKind } | { ok: false; code: "zip" | "old_office" | "type" };

export function checkName(name: string): NameCheck {
  const ext = extensionOf(name);
  const kind = BY_EXTENSION[ext];
  if (kind) return { ok: true, kind };
  if (ext === ".zip") return { ok: false, code: "zip" };
  return { ok: false, code: OLD_OFFICE.has(ext) ? "old_office" : "type" };
}
