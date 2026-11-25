import { HARD_MAX_UPLOAD_MB } from "./accept";

/** Upload and ingestion limits (CLAUDE.md section 8). Size comes from MAX_UPLOAD_MB. */
export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : HARD_MAX_UPLOAD_MB) * 1024 * 1024;
}

export const LIMITS = {
  pdfMaxPages: 300,
  /** Text kept from one Markdown, Word, Excel or PowerPoint file. */
  textMaxChars: 400_000,
  /** Where a long Word document is cut into sections. */
  sectionChars: 2500,
  sheetMaxRows: 2000,
  officeMaxEntries: 5000,
  officeMaxUncompressedBytes: 200 * 1024 * 1024,
  officeMaxPartBytes: 40 * 1024 * 1024,
  imageMaxPixels: 60_000_000,
  /** The longest side of the copy of a picture the AI gets. */
  aiImageSide: 2048,
  maxFilesPerProject: 12,
} as const;
