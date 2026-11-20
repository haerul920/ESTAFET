import { LIMITS } from "./limits";
import { UploadRejected } from "./magic";
import type { ExtractedPage } from "./types";

/** Extracts text per page with pdfjs-dist (legacy build, no canvas, no worker fetch). */
export async function extractPdfPages(data: Uint8Array): Promise<ExtractedPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
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
  } catch {
    throw new UploadRejected("This PDF could not be read. It may be damaged or password protected.");
  }
  if (doc.numPages > LIMITS.pdfMaxPages) {
    await task.destroy();
    throw new UploadRejected(`This PDF has ${doc.numPages} pages. The limit is ${LIMITS.pdfMaxPages}.`);
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
