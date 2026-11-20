/**
 * Uploads the private files for the DEMO projects created by supabase/seed.sql.
 * All content is synthetic. Every quote that a seeded item cites is written onto the cited page,
 * so the evidence check finds it. Run after `supabase db reset`:  pnpm seed:storage
 */
import { assertSafeTarget } from "./lib/env";
import { createClient } from "@supabase/supabase-js";
import { makePdf } from "../src/lib/demo/make-pdf";
import { extractPdfPages } from "../src/lib/ingest/pdf";
import { parseMarkdownSections } from "../src/lib/ingest/markdown";
import { checkItemEvidence } from "../src/lib/evidence/match";

assertSafeTarget("seed:storage");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see scripts/lib/env.ts).");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

interface FileRow {
  id: string;
  project_id: string;
  kind: "pdf" | "markdown";
  original_name: string;
  page_count: number;
  storage_path: string;
  extracted_text_path: string;
}
interface ItemRow {
  title: string;
  description: string;
  kind: string;
  evidence: { file_id: string; page: number; quote: string }[];
  evidence_status: string;
}

const SECTION_TITLES = ["Overview", "Background", "Labeling", "Results", "Open questions", "Next steps"];

function pdfPages(file: FileRow, projectTitle: string, items: ItemRow[]): string[] {
  return Array.from({ length: file.page_count }, (_, i) => {
    const page = i + 1;
    const lines = [
      `${projectTitle} (demo document, page ${page})`,
      "This page is synthetic demo content created for ESTAFET. It is not a real report.",
    ];
    for (const it of items) {
      for (const ev of it.evidence) {
        if (ev.file_id === file.id && ev.page === page && it.evidence_status === "matched") {
          lines.push(`Notes on ${it.title.replace(/\.$/, "")}.`, ev.quote, "See the rest of this demo document for context.");
        }
      }
    }
    return lines.join("\n");
  });
}

function markdownText(file: FileRow, projectTitle: string, items: ItemRow[]): string {
  const out: string[] = [];
  for (let section = 1; section <= file.page_count; section++) {
    const title = SECTION_TITLES[section - 1] ?? `Section ${section}`;
    out.push(`${section === 1 ? "#" : "##"} ${title}`, "");
    if (section === 1) out.push(`${projectTitle}. Synthetic demo notes created for ESTAFET.`, "");
    for (const it of items) {
      for (const ev of it.evidence) {
        if (ev.file_id === file.id && ev.page === section && it.evidence_status === "matched") {
          out.push(`- ${ev.quote}`);
        }
      }
    }
    out.push("");
  }
  return out.join("\n");
}

async function main() {
  const { data: projects, error } = await admin.from("projects").select("id, title").eq("is_demo", true);
  if (error) throw error;
  let uploaded = 0;
  let unmatched = 0;

  for (const project of projects ?? []) {
    const { data: files } = await admin.from("project_files").select("*").eq("project_id", project.id);
    const { data: items } = await admin.from("draft_items").select("title, description, kind, evidence, evidence_status").eq("project_id", project.id);
    const itemRows = (items ?? []) as ItemRow[];
    const pagesByFile = new Map<string, Map<number, string>>();

    for (const file of (files ?? []) as FileRow[]) {
      let bytes: Uint8Array;
      let pages;
      let contentType: string;
      if (file.kind === "pdf") {
        bytes = makePdf(pdfPages(file, project.title, itemRows));
        pages = await extractPdfPages(bytes);
        contentType = "application/pdf";
      } else {
        const text = markdownText(file, project.title, itemRows);
        bytes = new TextEncoder().encode(text);
        pages = parseMarkdownSections(text);
        contentType = "text/markdown";
      }
      const doc = { fileName: file.original_name, kind: file.kind, pages };
      pagesByFile.set(file.id, new Map(pages.map((p) => [p.page, p.text])));

      const a = await admin.storage.from("project-files").upload(file.storage_path, bytes, { contentType, upsert: true });
      const b = await admin.storage.from("extracted-text").upload(file.extracted_text_path, JSON.stringify(doc), { contentType: "application/json", upsert: true });
      if (a.error || b.error) throw new Error(`Upload failed for ${file.original_name}: ${a.error?.message ?? b.error?.message}`);
      await admin.from("project_files").update({ size_bytes: bytes.length }).eq("id", file.id);
      uploaded++;
    }

    // Verify: the server-side evidence check agrees with the seeded evidence_status.
    for (const it of itemRows) {
      const status = checkItemEvidence(it.evidence, pagesByFile);
      if (status !== it.evidence_status) {
        unmatched++;
        console.warn(`  mismatch in "${project.title}": "${it.title}" seeded=${it.evidence_status} checked=${status}`);
      }
    }
  }
  console.log(`Uploaded ${uploaded} demo files. Evidence mismatches: ${unmatched}.`);
  if (unmatched > 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
