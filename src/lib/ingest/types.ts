/** One citable unit: a PDF page, a Markdown section, or a block of a code folder tree. */
export interface ExtractedPage {
  /** 1-based. PDF page number, Markdown section number, or code-tree block number. */
  page: number;
  label: string;
  text: string;
}

export interface ExtractedDoc {
  fileName: string;
  kind: "pdf" | "markdown" | "code_tree";
  pages: ExtractedPage[];
}
