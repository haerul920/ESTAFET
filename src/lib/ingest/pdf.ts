import { LIMITS } from "./limits";
import { UploadRejected } from "./magic";
import type { ExtractedPage } from "./types";

/** Extracts text per page with pdfjs-dist (legacy build, no canvas, no worker fetch). */
export async function extractPdfPages(data: Uint8Array): Promise<ExtractedPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdfjs loads its worker through a computed path, which the build's file tracing cannot see, so a deployed
  // server would not get the file. This literal import ships it and registers it for pdfjs.
  // @ts-expect-error pdfjs ships no type declarations for the worker module
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(data), // pdfjs takes ownership of the buffer
    useWorkerFetch: false,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    // Only these two mean the file is at fault. Anything else is our failure: the upload route logs it.
    const name = e instanceof Error ? e.name : "";
    if (name === "InvalidPDFException" || name === "PasswordException") throw new UploadRejected("pdf_broken");
    throw e;
  }
  if (doc.numPages > LIMITS.pdfMaxPages) {
    await task.destroy();
    throw new UploadRejected("pdf_pages", { pages: doc.numPages, max: LIMITS.pdfMaxPages });
  }
  const pages: ExtractedPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str;
      text += item.hasEOL ? "\n" : " ";
    }
    pages.push({ page: n, label: `Page ${n}`, text: text.replace(/[ \t]+\n/g, "\n").trim() });
    page.cleanup();
  }
  await task.destroy();
  return pages;
}
