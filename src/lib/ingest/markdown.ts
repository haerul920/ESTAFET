import { unified } from "unified";
import remarkParse from "remark-parse";
import { toString } from "mdast-util-to-string";
import type { Root, RootContent } from "mdast";
import type { ExtractedPage } from "./types";

interface Section {
  title: string;
  parts: string[];
  intro: boolean;
}

/**
 * Splits Markdown into sections at headings (depth 1 to 3). Text before the first heading becomes
 * section 1 "Introduction" when it is not empty. Section numbers are what evidence cites as `page`.
 */
export function parseMarkdownSections(source: string): ExtractedPage[] {
  const tree = unified().use(remarkParse).parse(source) as Root;
  const sections: Section[] = [];
  let current: Section = { title: "Introduction", parts: [], intro: true };

  for (const node of tree.children as RootContent[]) {
    if (node.type === "heading" && node.depth <= 3) {
      if (!(current.intro && current.parts.length === 0)) sections.push(current);
      current = { title: toString(node).trim() || "Untitled section", parts: [], intro: false };
    } else {
      current.parts.push(blockText(node));
    }
  }
  if (!(current.intro && current.parts.length === 0)) sections.push(current);

  return sections.map((s, i) => {
    const body = s.parts.filter(Boolean).join("\n").trim();
    return { page: i + 1, label: s.title, text: s.intro ? body : body ? `${s.title}\n${body}` : s.title };
  });
}

function blockText(node: RootContent): string {
  if (node.type === "list") {
    return node.children
      .map((li) => toString(li).trim())
      .filter(Boolean)
      .join("\n");
  }
  if (node.type === "code") return node.value;
  return toString(node).trim();
}
