/** Upload and ingestion limits (CLAUDE.md section 8). Size comes from MAX_UPLOAD_MB. */
export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : 25) * 1024 * 1024;
}

export const LIMITS = {
  zipMaxEntries: 5000,
  zipMaxUncompressedBytes: 500 * 1024 * 1024,
  zipTextFileMaxBytes: 64 * 1024,
  pdfMaxPages: 300,
  markdownMaxChars: 400_000,
  maxFilesPerProject: 12,
  treeMaxPaths: 400,
} as const;
