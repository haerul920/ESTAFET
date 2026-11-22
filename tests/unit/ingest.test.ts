import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { makePdf } from "@/lib/demo/make-pdf";
import { detectUploadKind, UploadRejected } from "@/lib/ingest/magic";
import { parseMarkdownSections } from "@/lib/ingest/markdown";
import { extractPdfPages } from "@/lib/ingest/pdf";
import { findSecretPatterns, sensitiveNameReason } from "@/lib/ingest/secrets-scan";
import { assertSafeEntryPath, readZipTree } from "@/lib/ingest/zip-tree";
import { ingestUpload } from "@/lib/ingest";

const enc = (s: string) => new TextEncoder().encode(s);

describe("magic bytes", () => {
  it("accepts a real PDF, ZIP and Markdown", async () => {
    expect(detectUploadKind("a.pdf", makePdf(["hello"]))).toBe("pdf");
    const zip = await new JSZip().file("a.txt", "x").generateAsync({ type: "uint8array" });
    expect(detectUploadKind("code.zip", zip)).toBe("zip");
    expect(detectUploadKind("notes.md", enc("# Title\n\ntext"))).toBe("markdown");
  });

  it("rejects a file whose extension lies about its content", async () => {
    expect(() => detectUploadKind("report.pdf", enc("just text"))).toThrow(UploadRejected);
    expect(() => detectUploadKind("code.zip", enc("not a zip"))).toThrow(UploadRejected);
    const zip = await new JSZip().file("a.txt", "x").generateAsync({ type: "uint8array" });
    expect(() => detectUploadKind("notes.md", zip)).toThrow(UploadRejected);
    expect(() => detectUploadKind("notes.md", new Uint8Array([0x41, 0x00, 0x42]))).toThrow(UploadRejected);
  });

  it("rejects other types and empty files", () => {
    expect(() => detectUploadKind("run.exe", enc("MZ"))).toThrow(UploadRejected);
    expect(() => detectUploadKind("a.pdf", new Uint8Array())).toThrow(UploadRejected);
  });
});

describe("ZIP safety", () => {
  it("rejects path traversal and absolute paths", () => {
    expect(() => assertSafeEntryPath("../evil.sh")).toThrow(UploadRejected);
    expect(() => assertSafeEntryPath("a/../../evil")).toThrow(UploadRejected);
    expect(() => assertSafeEntryPath("/etc/passwd")).toThrow(UploadRejected);
    expect(() => assertSafeEntryPath("C:\\Windows\\x")).toThrow(UploadRejected);
    expect(() => assertSafeEntryPath("src/app/main.ts")).not.toThrow();
  });

  it("rejects a whole archive that contains a traversal entry", async () => {
    const zip = new JSZip();
    zip.file("README.md", "ok");
    zip.file("../../evil.txt", "bad");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    await expect(readZipTree(bytes)).rejects.toBeInstanceOf(UploadRejected);
  });

  it("lists the tree, reads README and manifests only, and skips sensitive files", async () => {
    const zip = new JSZip();
    zip.file("README.md", "# Demo\nA tiny project.");
    zip.file("package.json", '{"name":"demo","dependencies":{"react":"19"}}');
    zip.file("src/index.ts", "SECRET_SOURCE_CODE_MUST_NOT_BE_READ");
    zip.file(".env", "API_KEY=abcdefghijklmnop12345");
    zip.file("config/keys.json", "{}");
    zip.file("node_modules/x/index.js", "noise");
    const tree = await readZipTree(await zip.generateAsync({ type: "uint8array" }));
    expect(tree.skipped.map((s) => s.name).sort()).toEqual([".env", "config/keys.json"]);
    expect(tree.readme?.text).toContain("tiny project");
    expect(tree.manifests.map((m) => m.path)).toEqual(["package.json"]);
    expect(tree.tree).toContain("src/index.ts");
    expect(tree.tree.some((p) => p.includes("node_modules"))).toBe(false);
    expect(JSON.stringify(tree)).not.toContain("SECRET_SOURCE_CODE_MUST_NOT_BE_READ");
    expect(JSON.stringify(tree)).not.toContain("abcdefghijklmnop12345");
  });

  it("stores a sanitized tree, never the original archive, and reports the skipped files", async () => {
    const zip = new JSZip();
    zip.file("README.md", "# Demo");
    zip.file(".env", "TOKEN=1234567890abcdefghij");
    const result = await ingestUpload("code.zip", await zip.generateAsync({ type: "uint8array" }));
    expect(result.status).toBe("check");
    expect(result.note).toContain("skipped and not stored");
    expect(new TextDecoder().decode(result.storeBytes!)).not.toContain("1234567890abcdefghij");
    expect(result.storeName.endsWith(".tree.json")).toBe(true);
  });
});

describe("secrets scan", () => {
  it.each([
    ".env",
    ".env.local",
    "server.pem",
    "id_rsa",
    "id_rsa.pub",
    "deploy.key",
    "credentials.json",
    "credentials-prod.json",
    "keys.json",
    "a/b/.env.production",
  ])("flags the file name %s", (name) => {
    expect(sensitiveNameReason(name)).not.toBeNull();
  });
  it.each(["README.md", "src/env.ts", "keyboard.ts", "package.json", "notes.md"])("allows the file name %s", (name) => {
    expect(sensitiveNameReason(name)).toBeNull();
  });

  it("finds common token patterns", () => {
    expect(findSecretPatterns("key AKIAABCDEFGHIJKLMNOP here")).toHaveLength(1);
    expect(findSecretPatterns("-----BEGIN RSA PRIVATE KEY-----")).toHaveLength(1);
    expect(findSecretPatterns("token ghp_" + "a".repeat(36))).toHaveLength(1);
    expect(findSecretPatterns("password = hunter2hunter2hunter2", { loose: true })).toHaveLength(1);
    expect(findSecretPatterns("password = hunter2hunter2hunter2")).toHaveLength(0); // strict mode ignores prose
    expect(findSecretPatterns("We discuss the baseline and the sampling plan.", { loose: true })).toHaveLength(0);
  });

  it("skips a Markdown file that contains a token and tells the creator", async () => {
    const r = await ingestUpload("notes.md", enc("# Notes\n\nOur key is AKIAABCDEFGHIJKLMNOP\n"));
    expect(r.storeBytes).toBeNull();
    expect(r.status).toBe("check");
    expect(r.skipped).toHaveLength(1);
  });
});

describe("parsers", () => {
  it("splits Markdown into numbered sections", () => {
    const pages = parseMarkdownSections(
      "# Overview\nIntro text.\n\n## Labeling\nLabeled so far: canopy.\n\n## Next\n- TODO: more data.\n",
    );
    expect(pages.map((p) => p.label)).toEqual(["Overview", "Labeling", "Next"]);
    expect(pages[1].page).toBe(2);
    expect(pages[2].text).toContain("TODO: more data.");
  });

  it("extracts text per page from a PDF", async () => {
    const pdf = makePdf(["First page about drones.", "Second page: A short monitoring guide will be produced."]);
    const pages = await extractPdfPages(pdf);
    expect(pages).toHaveLength(2);
    expect(pages[1].text).toContain("monitoring guide");
  });

  it("rejects a corrupt PDF with a readable message", async () => {
    await expect(extractPdfPages(enc("%PDF-1.4 garbage"))).rejects.toBeInstanceOf(UploadRejected);
  });
});
