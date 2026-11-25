import JSZip from "jszip";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { makePdf } from "@/lib/demo/make-pdf";
import { ACCEPT_ATTRIBUTE, checkName } from "@/lib/ingest/accept";
import { detectUploadKind, UploadRejected } from "@/lib/ingest/magic";
import { parseMarkdownSections } from "@/lib/ingest/markdown";
import { assertSafeEntryPath, decodeXml } from "@/lib/ingest/office";
import { imageForAi } from "@/lib/ingest/image";
import { extractPdfPages } from "@/lib/ingest/pdf";
import { findSecretPatterns, sensitiveNameReason } from "@/lib/ingest/secrets-scan";
import { ingestUpload } from "@/lib/ingest";
import { officeFile } from "../office-fixtures";

const enc = (s: string) => new TextEncoder().encode(s);
const plainZip = () => new JSZip().file("a.txt", "x").generateAsync({ type: "uint8array" });
const refusal = async (name: string, bytes: Uint8Array) => {
  const error = await ingestUpload(name, bytes).then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(UploadRejected);
  return (error as UploadRejected).code;
};
const picture = async (format: "jpeg" | "png", width = 40, height = 30) => {
  const base = sharp({ create: { width, height, channels: 3, background: "#2266aa" } });
  const withLocation = base.withExif({ IFD0: { Artist: "Someone" }, IFD3: { GPSLatitudeRef: "S" } });
  return new Uint8Array(await (format === "jpeg" ? withLocation.jpeg() : withLocation.png()).toBuffer());
};

describe("which files are accepted", () => {
  it("accepts PDF, Markdown, pictures and the new Office formats", () => {
    const names = ["a.pdf", "a.md", "a.markdown", "a.JPG", "a.jpeg", "a.png", "a.docx", "a.xlsx", "a.pptx"];
    expect(names.map((n) => checkName(n).ok)).toEqual(names.map(() => true));
    expect(ACCEPT_ATTRIBUTE).toContain(".pdf");
    expect(ACCEPT_ATTRIBUTE).not.toContain(".zip");
  });

  it("refuses ZIP, the old Office formats and everything else, each with its own reason", () => {
    expect(checkName("code.zip")).toEqual({ ok: false, code: "zip" });
    for (const name of ["a.doc", "a.xls", "a.ppt"]) expect(checkName(name)).toEqual({ ok: false, code: "old_office" });
    for (const name of ["run.exe", "a.docm", "a.svg", "a.gif", "noextension"])
      expect(checkName(name)).toEqual({ ok: false, code: "type" });
  });

  it("checks the first bytes, not only the name", async () => {
    expect(detectUploadKind("a.pdf", makePdf(["hello"]))).toBe("pdf");
    expect(detectUploadKind("notes.md", enc("# Title\n\ntext"))).toBe("markdown");
    expect(detectUploadKind("a.png", await picture("png"))).toBe("image");
    expect(detectUploadKind("a.jpg", await picture("jpeg"))).toBe("image");
    const lies: [string, Uint8Array][] = [
      ["report.pdf", enc("just text")],
      ["photo.png", await picture("jpeg")],
      ["photo.jpg", enc("not a picture")],
      ["report.docx", enc("not a container")],
      ["notes.md", await plainZip()],
      ["notes.md", new Uint8Array([0x41, 0x00, 0x42])],
      ["a.pdf", new Uint8Array()],
    ];
    for (const [name, bytes] of lies) expect(() => detectUploadKind(name, bytes), name).toThrow(UploadRejected);
  });
});

describe("Word, Excel and PowerPoint", () => {
  it("reads a Word file in sections, with entities and headings", async () => {
    const bytes = await officeFile.word([
      { text: "Ringkasan proyek", heading: true },
      { text: "Data diambil dari dua lokasi & diberi label." },
      { text: "Langkah lanjutan", heading: true },
      { text: "TODO: tambah label untuk <tepi> mangrove." },
    ]);
    const result = await ingestUpload("laporan.docx", bytes);
    expect(result.kind).toBe("word");
    expect(result.status).toBe("ready");
    expect(result.doc!.pages.map((p) => p.text)).toEqual([
      "Ringkasan proyek\nData diambil dari dua lokasi & diberi label.",
      "Langkah lanjutan\nTODO: tambah label untuk <tepi> mangrove.",
    ]);
    expect(result.contentType).toContain("wordprocessingml");
  });

  it("reads each sheet of a spreadsheet as rows", async () => {
    const bytes = await officeFile.spreadsheet([
      {
        name: "Anggaran",
        rows: [
          ["Barang", "Harga"],
          ["Drone", 1500],
        ],
      },
      { name: "Catatan", rows: [["Belum diuji di lapangan"]] },
    ]);
    const result = await ingestUpload("data.xlsx", bytes);
    expect(result.doc!.pages).toEqual([
      { page: 1, label: "Sheet Anggaran", text: "Barang | Harga\nDrone | 1500" },
      { page: 2, label: "Sheet Catatan", text: "Belum diuji di lapangan" },
    ]);
  });

  it("reads slides in presentation order and keeps their numbers", async () => {
    const bytes = await officeFile.slides([["Tujuan", "Memantau mangrove"], [], ["Rencana: uji lapangan"]]);
    const result = await ingestUpload("deck.pptx", bytes);
    expect(result.doc!.pages).toEqual([
      { page: 1, label: "Slide 1", text: "Tujuan\nMemantau mangrove" },
      { page: 3, label: "Slide 3", text: "Rencana: uji lapangan" },
    ]);
  });

  it("refuses a renamed ZIP archive, a wrong kind of document and macros", async () => {
    expect(await refusal("renamed.docx", await plainZip())).toBe("office_broken");
    expect(await refusal("sheet.docx", await officeFile.spreadsheet([{ name: "a", rows: [["b"]] }]))).toBe(
      "office_broken",
    );
    const macro = await officeFile.word([{ text: "x" }], { "word/vbaProject.bin": "binary" });
    expect(await refusal("macro.docx", macro)).toBe("office_macros");
  });

  it("refuses unsafe paths inside a document", async () => {
    for (const path of ["../evil.sh", "a/../../evil", "/etc/passwd", "C:\\Windows\\x"])
      expect(() => assertSafeEntryPath(path)).toThrow(UploadRejected);
    expect(() => assertSafeEntryPath("word/media/image1.png")).not.toThrow();
    const bytes = await officeFile.word([{ text: "x" }], { "../../evil.txt": "bad" });
    expect(await refusal("evil.docx", bytes)).toBe("office_unsafe");
  });

  it("does not keep a document that contains a secret", async () => {
    const result = await ingestUpload("kunci.docx", await officeFile.word([{ text: "Key AKIAABCDEFGHIJKLMNOP" }]));
    expect(result.storeBytes).toBeNull();
    expect(result.doc).toBeNull();
    expect(result.status).toBe("check");
    expect(result.note.code).toBe("secret");
    expect(result.skipped).toHaveLength(1);
  });

  it("decodes XML entities once", () => {
    expect(decodeXml("a &amp;lt; b &#233; &#x41; &bogus;")).toBe("a &lt; b é A &bogus;");
  });
});

describe("pictures", () => {
  it("stores the picture again without camera data, and sends nothing to an AI", async () => {
    const original = await picture("jpeg");
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const result = await ingestUpload("foto.jpg", original);
    expect(result.kind).toBe("image");
    expect(result.contentType).toBe("image/jpeg");
    expect((await sharp(result.storeBytes!).metadata()).exif).toBeUndefined();
    expect(result.doc!.pages).toEqual([{ page: 1, label: "Image", text: "" }]);
    expect(result.note).toEqual({ code: "image", values: { width: 40, height: 30 } });
  });

  it("refuses a damaged picture", async () => {
    const broken = (await picture("png")).slice(0, 40);
    expect(await refusal("rusak.png", broken)).toBe("image_broken");
  });

  it("gives the AI a smaller JPEG, whatever the size of the original", async () => {
    const big = await picture("png", 4000, 1000);
    const sent = Buffer.from(await imageForAi(big), "base64");
    const meta = await sharp(sent).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([2048, 512]);
  });
});

describe("size limit", () => {
  it("is 50 MB unless set otherwise", async () => {
    const saved = process.env.MAX_UPLOAD_MB;
    delete process.env.MAX_UPLOAD_MB;
    try {
      const justOver = new Uint8Array(50 * 1024 * 1024 + 1);
      justOver.set(enc("%PDF-"));
      expect(await refusal("besar.pdf", justOver)).toBe("too_big");
    } finally {
      if (saved !== undefined) process.env.MAX_UPLOAD_MB = saved;
    }
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

  it("rejects a corrupt PDF", async () => {
    await expect(extractPdfPages(enc("%PDF-1.4 garbage"))).rejects.toBeInstanceOf(UploadRejected);
  });
});
