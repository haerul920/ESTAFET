import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scanUpload } from "@/lib/ingest/scan";

/** The upload scanning hook, against a tiny scanner running on this machine. */
async function scanner(handler: (body: Buffer, name: string) => { status: number; body: string }) {
  const seen: { name: string; size: number }[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const name = decodeURIComponent(String(req.headers["x-file-name"] ?? ""));
      seen.push({ name, size: body.length });
      const r = handler(body, name);
      res.statusCode = r.status;
      res.end(r.body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/scan`;
  return { url, seen, close: () => new Promise<void>((r) => server.close(() => r())) };
}

afterEach(() => vi.unstubAllEnvs());

describe("scanUpload", () => {
  it("scans nothing and lets the file through when no scanner is configured", async () => {
    vi.stubEnv("UPLOAD_SCAN_URL", "");
    expect(await scanUpload("a.pdf", new Uint8Array([1]))).toEqual({ clean: true });
  });

  it("sends the bytes and the name, and accepts a clean answer", async () => {
    const s = await scanner(() => ({ status: 200, body: '{"infected": false}' }));
    vi.stubEnv("UPLOAD_SCAN_URL", s.url);
    expect(await scanUpload("Laporan Akhir.pdf", new Uint8Array([1, 2, 3]))).toEqual({ clean: true });
    expect(s.seen).toEqual([{ name: "Laporan Akhir.pdf", size: 3 }]);
    await s.close();
  });

  it("rejects an infected file, an error status and a malformed answer", async () => {
    for (const reply of [
      { status: 200, body: '{"infected": true}' },
      { status: 500, body: "boom" },
      { status: 200, body: "not json" },
      { status: 200, body: "{}" },
    ]) {
      const s = await scanner(() => reply);
      vi.stubEnv("UPLOAD_SCAN_URL", s.url);
      expect(await scanUpload("x.pdf", new Uint8Array([1]))).toEqual({ clean: false });
      await s.close();
    }
  });

  it("blocks the upload when the scanner is down", async () => {
    const s = await scanner(() => ({ status: 200, body: '{"infected": false}' }));
    const url = s.url;
    await s.close();
    vi.stubEnv("UPLOAD_SCAN_URL", url);
    expect(await scanUpload("x.pdf", new Uint8Array([1]))).toEqual({ clean: false });
  });
});
