import JSZip from "jszip";
import { LIMITS } from "./limits";
import { UploadRejected } from "./magic";
import type { ExtractedPage } from "./types";

/**
 * Reads the text of Word, Excel and PowerPoint files (the .docx, .xlsx and .pptx formats). Only the XML parts that
 * hold text are opened. Nothing is executed, nothing is written to disk, and files with macros are refused.
 */
export type OfficeKind = "word" | "spreadsheet" | "slides";

const MAIN_PART: Record<OfficeKind, string> = {
  word: "word/document.xml",
  spreadsheet: "xl/workbook.xml",
  slides: "ppt/presentation.xml",
};

type InternalEntry = { _data?: { uncompressedSize?: number } };
// jszip internal, there is no public way to read the declared size
const sizeOf = (entry: JSZip.JSZipObject) => (entry as unknown as InternalEntry)._data?.uncompressedSize ?? 0;

/** Rejects absolute paths, drive letters, NUL bytes and `..` segments. Throws for the whole file. */
export function assertSafeEntryPath(name: string): void {
  const normalized = name.replace(/\\/g, "/");
  const unsafe =
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.includes("\0") ||
    normalized.split("/").some((segment) => segment === "..");
  if (unsafe) throw new UploadRejected("office_unsafe");
}

async function open(kind: OfficeKind, data: Uint8Array): Promise<JSZip> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new UploadRejected("office_broken");
  }
  const names = Object.keys(zip.files);
  if (names.length > LIMITS.officeMaxEntries) throw new UploadRejected("office_unsafe");
  let total = 0;
  for (const name of names) {
    // JSZip cleans paths up while loading, so the name as written in the file is the one to judge.
    const written = (zip.files[name] as unknown as { unsafeOriginalName?: string }).unsafeOriginalName;
    assertSafeEntryPath(written ?? name);
    total += sizeOf(zip.files[name]);
    if (total > LIMITS.officeMaxUncompressedBytes) throw new UploadRejected("office_unsafe");
  }
  // A renamed ZIP archive has none of these parts, so it cannot pass as a document.
  if (!zip.file("[Content_Types].xml") || !zip.file(MAIN_PART[kind])) throw new UploadRejected("office_broken");
  if (names.some((name) => /(^|\/)vbaProject\.bin$/i.test(name))) throw new UploadRejected("office_macros");
  return zip;
}

async function part(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);
  if (!entry) return "";
  if (sizeOf(entry) > LIMITS.officeMaxPartBytes) throw new UploadRejected("office_unsafe");
  return entry.async("string");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, code: string) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? whole;
    const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return point <= 0x10ffff ? String.fromCodePoint(point) : whole;
  });
}

function attributes(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], decodeXml(m[2])]));
}

/** `rId3` -> the part it points to. `base` is the folder relative targets start from. */
function relations(xml: string, base: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const a = attributes(match[0]);
    if (a.Id && a.Target) out.set(a.Id, a.Target.startsWith("/") ? a.Target.slice(1) : base + a.Target);
  }
  return out;
}

/** The text inside every `<tag>` element, joined. */
function textRuns(xml: string, tag: string): string {
  const found = xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, "g"));
  return [...found].map((m) => decodeXml(m[1])).join("");
}

/** Collects pages and stops at the text limit, so one huge file cannot fill the memory of a draft. */
class Pages {
  private readonly pages: ExtractedPage[] = [];
  private total = 0;

  /** `number` keeps a page's own number (a slide), otherwise pages are counted. */
  add(label: string, lines: string[], number = this.pages.length + 1) {
    const room = Math.max(0, LIMITS.textMaxChars - this.total);
    const text = lines.join("\n").trim().slice(0, room);
    if (!text) return;
    this.total += text.length;
    this.pages.push({ page: number, label, text });
  }

  get next() {
    return this.pages.length + 1;
  }

  list() {
    return this.pages;
  }
}

/** A Word file has no fixed pages, so it is cut into sections: at each heading, or when one grows long. */
async function readWord(zip: JSZip): Promise<ExtractedPage[]> {
  const xml = await part(zip, MAIN_PART.word);
  const pages = new Pages();
  let lines: string[] = [];
  let length = 0;
  const flush = () => {
    pages.add(`Section ${pages.next}`, lines);
    lines = [];
    length = 0;
  };
  for (const paragraph of xml.split("</w:p>")) {
    let line = "";
    for (const m of paragraph.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(tab|br)\b[^>]*\/>/g)) {
      line += m[2] ? (m[2] === "tab" ? "\t" : "\n") : decodeXml(m[1]);
    }
    if (!line.trim()) continue;
    const heading = /<w:pStyle\s+w:val="(?:heading|judul|title)[^"]*"/i.test(paragraph);
    if ((heading && length > 0) || length + line.length > LIMITS.sectionChars) flush();
    lines.push(line);
    length += line.length;
  }
  flush();
  return pages.list();
}

function cellValue(tag: string, inner: string, shared: string[]): string {
  const type = attributes(tag).t;
  if (type === "inlineStr") return textRuns(inner, "t");
  const raw = /<v>([^<]*)<\/v>/.exec(inner)?.[1] ?? "";
  if (type === "s") return shared[Number(raw)] ?? "";
  if (type === "b") return raw === "1" ? "TRUE" : raw === "0" ? "FALSE" : "";
  return decodeXml(raw);
}

/** One page per sheet, one line per row. Dates show as the numbers Excel stores. */
async function readSpreadsheet(zip: JSZip): Promise<ExtractedPage[]> {
  const shared = (await part(zip, "xl/sharedStrings.xml"))
    .split("</si>")
    .slice(0, -1)
    .map((item) => textRuns(item, "t"));
  const targets = relations(await part(zip, "xl/_rels/workbook.xml.rels"), "xl/");
  const pages = new Pages();
  let number = 0;
  for (const sheet of (await part(zip, MAIN_PART.spreadsheet)).matchAll(/<sheet\b[^>]*>/g)) {
    number += 1;
    const a = attributes(sheet[0]);
    const xml = await part(zip, targets.get(a["r:id"]) ?? "");
    const rows: string[] = [];
    for (const row of xml.split("</row>")) {
      if (rows.length >= LIMITS.sheetMaxRows) break;
      const cells = [...row.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
        .map((cell) => cellValue(cell[1], cell[2] ?? "", shared).trim())
        .filter(Boolean);
      if (cells.length) rows.push(cells.join(" | "));
    }
    pages.add(`Sheet ${a.name ?? number}`, rows, number);
  }
  return pages.list();
}

/** One page per slide, numbered as in the presentation, also after a slide that holds only pictures. */
async function readSlides(zip: JSZip): Promise<ExtractedPage[]> {
  const targets = relations(await part(zip, "ppt/_rels/presentation.xml.rels"), "ppt/");
  const order = [...(await part(zip, MAIN_PART.slides)).matchAll(/<p:sldId\b[^>]*>/g)].map(
    (m) => targets.get(attributes(m[0])["r:id"]) ?? "",
  );
  const pages = new Pages();
  for (const [index, path] of order.entries()) {
    const lines = (await part(zip, path))
      .split("</a:p>")
      .map((paragraph) => textRuns(paragraph, "a:t"))
      .filter((line) => line.trim());
    pages.add(`Slide ${index + 1}`, lines, index + 1);
  }
  return pages.list();
}

export async function extractOffice(kind: OfficeKind, data: Uint8Array): Promise<ExtractedPage[]> {
  const zip = await open(kind, data);
  if (kind === "word") return readWord(zip);
  return kind === "spreadsheet" ? readSpreadsheet(zip) : readSlides(zip);
}
