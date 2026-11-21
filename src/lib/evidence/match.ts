import { normalize, words } from "./normalize";

export type EvidenceStatus = "matched" | "partial" | "not_found";

export interface MatchResult {
  status: EvidenceStatus;
  /** 1 for an exact (normalized) substring, otherwise the best fuzzy score found. */
  score: number;
}

const FUZZY_THRESHOLD = 0.9;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

/** Best fuzzy similarity between the quote and any window of the page with a similar word count. */
function bestFuzzyScore(quote: string, pageText: string): number {
  const q = words(quote);
  const p = words(pageText);
  if (q.length === 0 || p.length === 0) return 0;
  const qJoined = q.join(" ");
  const qSet = new Map<string, number>();
  for (const w of q) qSet.set(w, (qSet.get(w) ?? 0) + 1);

  let best = 0;
  for (const size of [q.length, q.length - 1, q.length + 1]) {
    if (size < 1 || size > p.length) continue;
    for (let i = 0; i + size <= p.length; i++) {
      // cheap prefilter: most window words must appear in the quote
      let overlap = 0;
      for (let k = i; k < i + size; k++) if (qSet.has(p[k])) overlap++;
      if (overlap / Math.max(size, q.length) < 0.7) continue;
      const score = similarity(qJoined, p.slice(i, i + size).join(" "));
      if (score > best) best = score;
      if (best === 1) return 1;
    }
  }
  return best;
}

/**
 * Evidence check (CLAUDE.md section 7): `matched` if the normalized quote is a substring of the
 * normalized cited page, `partial` if a fuzzy score is at least 0.9, otherwise `not_found`.
 */
export function matchQuote(quote: string, pageText: string | undefined): MatchResult {
  if (!pageText || !quote.trim()) return { status: "not_found", score: 0 };
  const nq = normalize(quote);
  const np = normalize(pageText);
  if (nq.length > 0 && np.includes(nq)) return { status: "matched", score: 1 };
  const score = bestFuzzyScore(quote, pageText);
  if (score >= FUZZY_THRESHOLD) return { status: "partial", score };
  return { status: "not_found", score };
}

export interface EvidenceRefLike {
  file_id: string;
  page: number;
  quote: string;
}

/** pagesByFile: file_id -> page number -> text. An item is only `matched` if every quote matched. */
export function checkItemEvidence(
  evidence: EvidenceRefLike[],
  pagesByFile: Map<string, Map<number, string>>,
): EvidenceStatus {
  if (evidence.length === 0) return "not_found";
  const results = evidence.map((e) => matchQuote(e.quote, pagesByFile.get(e.file_id)?.get(e.page)).status);
  if (results.every((r) => r === "matched")) return "matched";
  if (results.every((r) => r === "not_found")) return "not_found";
  return "partial";
}

/** Splits a source page into text before the quote, the quote as written in the page, and text after. */
export function locateQuote(quote: string, pageText: string): { before: string; match: string; after: string } | null {
  const idx = pageText.toLowerCase().indexOf(quote.toLowerCase());
  if (idx >= 0) {
    return {
      before: pageText.slice(Math.max(0, idx - 240), idx).trim(),
      match: pageText.slice(idx, idx + quote.length),
      after: pageText.slice(idx + quote.length, idx + quote.length + 240).trim(),
    };
  }
  return null;
}
