import type { UploadKind } from "./accept";

/** One citable unit: a PDF page, a section of a Markdown or Word file, a sheet, a slide, or a picture. */
export interface ExtractedPage {
  /** 1-based. */
  page: number;
  label: string;
  text: string;
}

export interface ExtractedDoc {
  fileName: string;
  /** `code_tree` came from ZIP uploads, which are no longer accepted. Older projects still have them. */
  kind: UploadKind | "code_tree";
  pages: ExtractedPage[];
}
