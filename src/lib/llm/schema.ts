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
        effort: z.enum(["small", "medium", "large"]),
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

/** Why a synthesis failed, so the app can show a translated, useful message. Provider codes come from providers.ts. */
export type SynthesisErrorCode = "busy" | "timeout" | "quota" | "config" | "blocked" | "failed" | "format" | "empty";

/** `message` is technical English for the run record and the admin pipeline; people see a translated text per `code`. */
export class SynthesisError extends Error {
  constructor(
    message: string,
    readonly code: SynthesisErrorCode = "failed",
  ) {
    super(message);
    this.name = "SynthesisError";
  }
}
