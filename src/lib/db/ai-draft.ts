/** Rules around the AI draft and the basics of a project. Pure, so they are unit tested. */

const flat = (text: string) => text.replace(/\s+/g, " ").trim();
/** The AI summary is cut to this length when the owner applies it. */
const SUMMARY_MAX = 700;

/**
 * What to change on the project row when the owners take the AI back.
 * The AI draft writes the summary and the list of tools onto the project, so both go too:
 *  - the tools only ever come from the draft (no form edits them);
 *  - the summary goes only while it is still exactly what the AI wrote. Text the owners changed is theirs.
 * `aiSummaries` holds the summary of every finished run.
 */
export function aiRemovalPatch(
  summary: string,
  aiSummaries: (string | null)[],
): { fill_mode: null; tech?: string[]; summary?: string } {
  if (aiSummaries.length === 0) return { fill_mode: null };
  const current = flat(summary);
  const isAiText = aiSummaries.some((ai) => {
    if (!ai) return false;
    return current === flat(ai) || current === flat(ai.trim().slice(0, SUMMARY_MAX));
  });
  return { fill_mode: null, tech: [], ...(current && isAiText ? { summary: "" } : {}) };
}

/**
 * What still stops publishing, apart from the database rules. A draft saved from "Save and exit" may be missing
 * basics (Info step). The summary is written, or drafted by the AI, on the review step.
 */
export function publishGap(p: { title: string; summary: string; field: string }): "basics" | "summary" | null {
  if (p.title.trim().length < 3 || p.field.trim().length < 2) return "basics";
  return p.summary.trim().length < 30 ? "summary" : null;
}
