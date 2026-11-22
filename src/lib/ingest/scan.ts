import "server-only";
import { log } from "@/lib/log";

/**
 * Hook for a malware scan of uploads (CLAUDE.md 14.10, "upload scanning hook").
 *
 * With `UPLOAD_SCAN_URL` set, every upload is POSTed to that address (raw bytes, `content-type: application/octet-stream`,
 * `x-file-name` with a sanitised name). A scanner service (for example a ClamAV REST wrapper) answers 200 with
 * `{"infected": false}` when the file is clean. Anything else is treated as NOT clean: an infected answer, an error
 * status, a timeout. A scanner that is down therefore blocks uploads instead of letting them through unchecked.
 *
 * Without `UPLOAD_SCAN_URL` nothing is scanned. The checks that always run are in `ingestUpload`: magic bytes, size,
 * ZIP limits (a ZIP is only listed, never unpacked), and the secrets scan. No scanner service ships with ESTAFET.
 */
export async function scanUpload(name: string, bytes: Uint8Array): Promise<{ clean: boolean }> {
  const url = process.env.UPLOAD_SCAN_URL;
  if (!url) return { clean: true };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-file-name": encodeURIComponent(name.slice(0, 120)),
      },
      body: bytes as unknown as BodyInit,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      log.warn("upload_scan.error", { status: res.status });
      return { clean: false };
    }
    const json = (await res.json()) as { infected?: unknown };
    return { clean: json.infected === false };
  } catch {
    log.warn("upload_scan.unreachable");
    return { clean: false };
  }
}
