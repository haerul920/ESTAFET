import JSZip from "jszip";
import { LIMITS } from "./limits";
import { UploadRejected } from "./magic";
import { findSecretPatterns, sensitiveNameReason, type SkippedFile } from "./secrets-scan";
import type { ExtractedPage } from "./types";

const MANIFESTS = new Set([
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "composer.json",
  "gemfile",
  "pubspec.yaml",
]);
const NOISE_DIRS = ["node_modules/", ".git/", ".next/", "dist/", "build/", "__pycache__/", ".venv/", "venv/", ".idea/"];

export interface ZipTree {
  entryCount: number;
  fileCount: number;
  tree: string[];
  treeTruncated: boolean;
  readme: { path: string; text: string } | null;
  manifests: { path: string; text: string }[];
  skipped: SkippedFile[];
}

/** Rejects absolute paths, drive letters, NUL bytes and `..` segments. Throws for the whole archive. */
export function assertSafeEntryPath(name: string): void {
  const normalized = name.replace(/\\/g, "/");
  const unsafe =
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.includes("\0") ||
    normalized.split("/").some((seg) => seg === "..");
  if (unsafe) {
    throw new UploadRejected(
      "This ZIP contains an unsafe path (absolute or using ..). It was rejected and nothing was extracted.",
    );
  }
}

function depth(path: string): number {
  return path.split("/").filter(Boolean).length;
}

type InternalEntry = { _data?: { uncompressedSize?: number } };

/**
 * Lists the folder tree and reads ONLY the README and package manifests. Nothing is executed,
 * nothing is written to disk, and sensitive files are never read.
 */
export async function readZipTree(data: Uint8Array): Promise<ZipTree> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new UploadRejected("This ZIP could not be opened. It may be damaged or encrypted.");
  }
  const names = Object.keys(zip.files);
  if (names.length > LIMITS.zipMaxEntries) {
    throw new UploadRejected(`This ZIP has ${names.length} entries. The limit is ${LIMITS.zipMaxEntries}.`);
  }

  let total = 0;
  for (const name of names) {
    assertSafeEntryPath(name);
    const size = (zip.files[name] as unknown as InternalEntry)._data?.uncompressedSize ?? 0; // jszip internal, no public API
    total += size;
    if (total > LIMITS.zipMaxUncompressedBytes) {
      throw new UploadRejected("This ZIP expands to more than the allowed size and was rejected.");
    }
  }

  const skipped: SkippedFile[] = [];
  const files: string[] = [];
  for (const name of names) {
    const entry = zip.files[name];
    if (entry.dir) continue;
    const norm = name.replace(/\\/g, "/");
    const reason = sensitiveNameReason(norm);
    if (reason) {
      skipped.push({ name: norm, reason });
      continue;
    }
    files.push(norm);
  }

  const visible = files.filter((f) => !NOISE_DIRS.some((d) => f.startsWith(d) || f.includes("/" + d)));
  const tree = visible.sort().slice(0, LIMITS.treeMaxPaths);

  // README: shallowest first
  const readmePath = files
    .filter((f) => /(^|\/)readme(\.[a-z]+)?$/i.test(f) && depth(f) <= 3 && !NOISE_DIRS.some((d) => f.includes(d)))
    .sort((a, b) => depth(a) - depth(b))[0];
  const manifestPaths = files.filter(
    (f) => MANIFESTS.has(f.split("/").pop()!.toLowerCase()) && depth(f) <= 3 && !NOISE_DIRS.some((d) => f.includes(d)),
  );

  async function readText(path: string): Promise<string | null> {
    const entry = zip.files[path] ?? zip.files[path.replace(/\//g, "\\")];
    if (!entry) return null;
    const size = (entry as unknown as InternalEntry)._data?.uncompressedSize ?? 0;
    if (size > LIMITS.zipTextFileMaxBytes) return null;
    const bytes = await entry.async("uint8array");
    if (bytes.length > LIMITS.zipTextFileMaxBytes) return null;
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
  }

  let readme: ZipTree["readme"] = null;
  if (readmePath) {
    const text = await readText(readmePath);
    if (text !== null) {
      if (findSecretPatterns(text, { loose: true }).length > 0) {
        skipped.push({ name: readmePath, reason: "Looks like it contains a secret or token" });
      } else {
        readme = { path: readmePath, text };
      }
    }
  }

  const manifests: ZipTree["manifests"] = [];
  for (const path of manifestPaths.slice(0, 6)) {
    const text = await readText(path);
    if (text === null) continue;
    if (findSecretPatterns(text, { loose: true }).length > 0) {
      skipped.push({ name: path, reason: "Looks like it contains a secret or token" });
      continue;
    }
    manifests.push({ path, text });
  }

  return {
    entryCount: names.length,
    fileCount: names.filter((n) => !zip.files[n].dir).length,
    tree,
    treeTruncated: visible.length > tree.length,
    readme,
    manifests,
    skipped,
  };
}

/** Turns a ZipTree into citable pages for the synthesis step. */
export function zipTreeToPages(t: ZipTree): ExtractedPage[] {
  const pages: ExtractedPage[] = [
    {
      page: 1,
      label: "Folder tree",
      text: t.tree.join("\n") + (t.treeTruncated ? "\n… (more files not listed)" : ""),
    },
  ];
  if (t.readme) pages.push({ page: pages.length + 1, label: `README (${t.readme.path})`, text: t.readme.text });
  for (const m of t.manifests) pages.push({ page: pages.length + 1, label: `Manifest (${m.path})`, text: m.text });
  return pages;
}
