/**
 * Normalizes text for quote matching: lowercase, fix hyphenated line breaks, unify quotes and
 * dashes, collapse whitespace. Applied to BOTH the quote and the page text.
 */
export function normalize(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/­/g, "") // soft hyphen
    .replace(/([A-Za-z0-9])-[ \t]*\r?\n[ \t]*([A-Za-z0-9])/g, "$1$2") // "gen-\neralization" -> "generalization"
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function words(input: string): string[] {
  return normalize(input)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function wordCount(input: string): number {
  return input.trim().split(/\s+/).filter(Boolean).length;
}
