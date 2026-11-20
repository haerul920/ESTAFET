import type { ExtractedDoc } from "@/lib/ingest/types";
import type { SynthesisOutput } from "./schema";

/**
 * Deterministic "AI". It reads the extracted text with simple rules (TODO lines, "not yet",
 * "reached", "lesson" ...) and quotes sentences verbatim. It also adds ONE deliberately unsupported
 * item so the "Evidence not found" state can be demonstrated. Output is simulated, never real AI.
 */

interface Sentence {
  file: string;
  page: number;
  text: string;
}

const TECH = [
  "Python", "TypeScript", "JavaScript", "React", "Next.js", "Node.js", "Flutter", "TensorFlow", "PyTorch",
  "Postgres", "Supabase", "Arduino", "ESP32", "Raspberry Pi", "Docker", "Django", "Flask", "FastAPI",
  "OpenCV", "scikit-learn", "Pandas", "R", "MATLAB", "Java", "Kotlin", "Rust", "Go",
];

function sentencesOf(docs: ExtractedDoc[]): Sentence[] {
  const out: Sentence[] = [];
  for (const d of docs) {
    for (const p of d.pages) {
      const parts = p.text
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
        .filter((s) => s.length >= 20 && s.length <= 400);
      for (const text of parts) out.push({ file: d.fileName, page: p.page, text });
    }
  }
  return out;
}

const clip = (s: string, n = 25) => s.split(/\s+/).slice(0, n).join(" ");
const sentenceTitle = (s: string) => {
  const t = s.replace(/^(todo|next|future work)\s*[:\-]\s*/i, "").replace(/[.!?]+$/, "");
  const words = t.split(/\s+/);
  const short = words.slice(0, 12).join(" ");
  return short.charAt(0).toUpperCase() + short.slice(1) + (words.length > 12 ? "…" : "");
};
const ev = (s: Sentence) => [{ file: s.file, page: s.page, quote: clip(s.text) }];
const uniq = <T,>(items: T[], key: (t: T) => string) => {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(key(i)) ? false : (seen.add(key(i)), true)));
};

const NEXT_RE = /\b(todo|still (?:has|have|needs?|missing)|not (?:yet|started|built|justified|designed)|needs? (?:far |much )?more|future work|planned but|never started|next milestone|should be|must be|was planned|were planned|left for future|recommend)/i;
const DONE_RE = /\b(reached|completed|collected|built|trained|extracted|computed|delivered|ran for|achieved|produced|finished|agrees?)\b/i;
const OBJ_RE = /\b(will be|aim|objective|goal|plan(?:ned)? to)\b/i;
const LESSON_RE = /\b(lesson|learned|learnt|delayed|blocker|feedback|reviewers?|asked for|more honest|dropped to|failed|corroded|differ(?:s)? a lot|only .* stayed|graduated before)\b/i;

function lessonType(text: string): SynthesisOutput["lessons"][number]["type"] {
  if (/fund|grant|panel|renew/i.test(text)) return "funding_feedback";
  if (/review|feedback|justif|represent/i.test(text)) return "evaluation_feedback";
  if (/delay|permit|graduat|corrod|failed|stayed|blocker|clash/i.test(text)) return "blocker";
  return "methodology";
}
function effortOf(text: string): "small" | "medium" | "large" {
  if (/\b(guide|deploy|pilot|build|app|system|test with|train)\b/i.test(text)) return "large";
  if (/\b(plan|check|agree|label|write|add)\b/i.test(text)) return "small";
  return "medium";
}

export function mockSynthesize(docs: ExtractedDoc[]): SynthesisOutput {
  const all = sentencesOf(docs);
  const nonEmpty = all.length > 0;

  const intro = all.find((s) => s.text.split(/\s+/).length >= 8) ?? all[0];
  const summary = intro
    ? clip(intro.text, 60)
    : "No readable text was found in the uploaded files, so no summary could be drafted.";

  const nextS = uniq(all.filter((s) => NEXT_RE.test(s.text)), (s) => s.text.toLowerCase()).slice(0, 5);
  const doneS = uniq(
    all.filter((s) => DONE_RE.test(s.text) && !NEXT_RE.test(s.text)),
    (s) => s.text.toLowerCase(),
  ).slice(0, 4);
  const objS = uniq(all.filter((s) => OBJ_RE.test(s.text)), (s) => s.text.toLowerCase()).slice(0, 5);
  const lessonS = uniq(
    all.filter((s) => LESSON_RE.test(s.text) && !NEXT_RE.test(s.text)),
    (s) => s.text.toLowerCase(),
  ).slice(0, 3);

  const tech = new Set<string>();
  const corpus = docs.flatMap((d) => d.pages.map((p) => p.text)).join("\n");
  for (const t of TECH) if (new RegExp(`(^|[^A-Za-z])${t.replace(/[.+]/g, "\\$&")}([^A-Za-z]|$)`).test(corpus)) tech.add(t);
  for (const d of docs) {
    if (d.kind !== "code_tree") continue;
    for (const p of d.pages) {
      if (/package\.json/.test(p.label)) tech.add("Node.js");
      if (/pyproject|requirements/.test(p.label)) tech.add("Python");
    }
  }

  const unsupportedSource = docs.find((d) => d.pages.length > 0);
  const unsupported = unsupportedSource
    ? [
        {
          title: "Deploy the project as a web service",
          description: "Mock mode adds one unsupported item on purpose so you can see how missing evidence looks.",
          effort: "large" as const,
          evidence: [
            {
              file: unsupportedSource.fileName,
              page: unsupportedSource.pages[0].page,
              quote: "The service will be deployed on the university cloud next semester.",
            },
          ],
        },
      ]
    : [];

  return {
    summary,
    objectives: objS.map((s) => ({
      title: sentenceTitle(s.text),
      status: DONE_RE.test(s.text) ? ("done" as const) : ("not_started" as const),
      evidence: ev(s),
    })),
    completed: doneS.map((s) => ({ title: sentenceTitle(s.text), description: "", evidence: ev(s) })),
    next_tasks: [
      ...nextS.map((s) => ({
        title: sentenceTitle(s.text),
        description: "",
        effort: effortOf(s.text),
        evidence: ev(s),
      })),
      ...(nonEmpty ? unsupported : []),
    ],
    lessons: lessonS.map((s) => ({ type: lessonType(s.text), text: s.text.replace(/\s+/g, " "), evidence: ev(s) })),
    tech: [...tech].slice(0, 10),
  };
}
