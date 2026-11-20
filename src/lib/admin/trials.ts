/** Pure helpers for the trials page: CSV export and the "methods and limits" paragraph. */

export interface TrialRow {
  id: string;
  participant_code: string;
  cohort: "baseline" | "estafet";
  project_title: string | null;
  started_at: string;
  minutes_to_understand: number | null;
  completed: boolean;
  correct_answers: number | null;
  total_questions: number | null;
  sus_score: number | null;
  is_demo: boolean;
}

export interface CohortSummary {
  cohort: "baseline" | "estafet";
  n: number;
  completed_n: number;
  median_minutes: number | null;
  mean_minutes: number | null;
  completion_rate: number | null;
  mean_score: number | null;
  mean_sus: number | null;
  within30_n: number;
  within30_share: number | null;
}

export const MIN_N = 5;
export const tooFew = (n: number | undefined) => (n ?? 0) < MIN_N;

const esc = (v: string | number | boolean | null) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Neutralize spreadsheet formulas and quote when needed.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV of sessions. Contains pseudonym codes only: never names or emails (those are not even in the row type). */
export function trialsCsv(rows: TrialRow[]): string {
  const head = ["participant_code", "cohort", "project", "started_at_utc", "minutes_to_understand", "completed", "correct_answers", "total_questions", "sus_score", "is_demo"];
  const lines = rows.map((r) =>
    [r.participant_code, r.cohort, r.project_title, r.started_at, r.minutes_to_understand, r.completed, r.correct_answers, r.total_questions, r.sus_score, r.is_demo].map(esc).join(","),
  );
  return [head.join(","), ...lines].join("\n") + "\n";
}

const pct = (v: number | null) => (v === null ? "n/a" : `${Math.round(v * 100)}%`);
const num = (v: number | null, unit = "") => (v === null ? "n/a" : `${v}${unit}`);

/** One paragraph the team can paste into the proposal. States n, the single university, and that results are indicative. */
export function methodsParagraph(summary: CohortSummary[], opts: { includesDemo: boolean; first?: string; last?: string }): string {
  const total = summary.reduce((a, c) => a + c.n, 0);
  if (total === 0) return "No sessions have been recorded yet, so there are no results to report.";
  const b = summary.find((c) => c.cohort === "baseline");
  const e = summary.find((c) => c.cohort === "estafet");
  const span = opts.first && opts.last ? ` between ${opts.first.slice(0, 10)} and ${opts.last.slice(0, 10)}` : "";
  const parts = [
    `We ran ${total} onboarding trial sessions${span} with students of one university (Universitas Hasanuddin): ${b?.n ?? 0} in a baseline condition (understanding a project from its raw files) and ${e?.n ?? 0} using an ESTAFET project page.`,
    `Each participant, identified only by a pseudonym code, consented to being included. For each session we recorded minutes to understand the project (summarized below for completed sessions only), the share of comprehension questions answered correctly, and, where collected, a System Usability Scale (SUS) score.`,
    `Median minutes to understand: baseline ${num(b?.median_minutes ?? null)} (n = ${b?.n ?? 0}), ESTAFET ${num(e?.median_minutes ?? null)} (n = ${e?.n ?? 0}). Completion: baseline ${pct(b?.completion_rate ?? null)}, ESTAFET ${pct(e?.completion_rate ?? null)}. Mean comprehension score: baseline ${pct(b?.mean_score ?? null)}, ESTAFET ${pct(e?.mean_score ?? null)}. Mean SUS for ESTAFET: ${num(e?.mean_sus ?? null)}. ${pct(e?.within30_share ?? null)} of ESTAFET sessions were completed within 30 minutes.`,
    `These results are indicative only: the sample is small, comes from one university, and is not a statistical sample.${tooFew(b?.n) || tooFew(e?.n) ? ` At least one cohort has fewer than ${MIN_N} sessions, so no conclusion should be drawn.` : ""}${opts.includesDemo ? " This figure includes demo rows and must not be quoted as a result." : ""}`,
  ];
  return parts.join(" ");
}
