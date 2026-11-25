import { z } from "zod";
import { wordCount } from "@/lib/evidence/normalize";

const quote = z
  .string()
  .trim()
  .min(1)
  .refine((q) => wordCount(q) <= 25, "A quote can be at most 25 words.");

const evidenceSchema = z.object({
  file: z.string().min(1),
  page: z.number().int().min(1),
  quote,
});

const evidenceList = z.array(evidenceSchema).min(1, "Every item needs at least one evidence quote.").max(3);

export const synthesisSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(1)
    .refine((s) => wordCount(s) <= 90, "The summary can be at most 90 words."),
  objectives: z
    .array(
      z.object({
        title: z.string().min(1),
        status: z.enum(["done", "in_progress", "not_started"]),
        evidence: evidenceList,
      }),
    )
    .max(12),
  completed: z
    .array(z.object({ title: z.string().min(1), description: z.string().default(""), evidence: evidenceList }))
    .max(12),
  next_tasks: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().default(""),
        evidence: evidenceList,
      }),
    )
    .max(15),
  lessons: z
    .array(
      z.object({
        type: z.enum(["methodology", "evaluation_feedback", "funding_feedback", "blocker"]),
        text: z.string().min(1),
        evidence: evidenceList,
      }),
    )
    .max(10),
  tech: z.array(z.string().min(1)).max(15),
});

export type SynthesisOutput = z.infer<typeof synthesisSchema>;
export type SynthesisEvidence = z.infer<typeof evidenceSchema>;

/** Why a draft could not be made. Each one has a plain message in both languages under `synth.error`. */
export const SYNTHESIS_FAILURES = [
  "busy",
  "quota",
  "unavailable",
  "connection",
  "badAnswer",
  "noText",
  "saveFailed",
  "failed",
] as const;
export type SynthesisFailure = (typeof SYNTHESIS_FAILURES)[number];

/**
 * With a `code`, the message is technical (kept with the run for troubleshooting) and the reader gets the translation
 * of the code. Without one, the message is already written for the reader.
 */
export class SynthesisError extends Error {
  constructor(
    message: string,
    readonly code?: SynthesisFailure,
  ) {
    super(message);
  }
}

/** Sorts whatever a provider call threw. Providers report an HTTP status as "... request failed (503).". */
export function providerFailure(error: unknown): SynthesisFailure {
  const message = error instanceof Error ? error.message : "";
  const status = Number(message.match(/request failed \((\d{3})\)/)?.[1] ?? 0);
  if (status === 429) return "quota";
  if ([500, 502, 503, 504, 529].includes(status)) return "busy";
  if ([401, 403, 404].includes(status) || /(_API_KEY|LLM_MODEL) is not set/.test(message)) return "unavailable";
  const name = error instanceof Error ? error.name : "";
  if (name === "AbortError" || name === "TimeoutError" || /fetch failed|network/i.test(message)) return "connection";
  return "failed";
}
