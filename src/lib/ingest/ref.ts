/** What a cited number counts in each kind of file: pages, sections, sheets or slides. A picture is just itself. */
export type RefKind = "page" | "section" | "sheet" | "slide" | "image";

const BY_FILE_KIND: Record<string, RefKind> = {
  markdown: "section",
  word: "section",
  spreadsheet: "sheet",
  slides: "slide",
  image: "image",
};

export const refKind = (fileKind: string | undefined): RefKind => BY_FILE_KIND[fileKind ?? ""] ?? "page";
