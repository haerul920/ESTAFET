import { z } from "zod";

/** Validation for a recorded onboarding trial session. Pseudonym codes only: no names, no emails. */
export const trialSchema = z
  .object({
    id: z.string().uuid().optional().or(z.literal("")),
    participant_code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{1,12}$/, "Use a pseudonym such as P01 (letters, numbers, - and _, up to 12)."),
    cohort: z.enum(["baseline", "estafet"], { message: "Choose a cohort." }),
    project_id: z.string().uuid().optional().or(z.literal("")),
    started_at: z.string().min(1, "Enter the start time."),
    minutes_to_understand: z.coerce
      .number()
      .min(0, "Minutes cannot be negative.")
      .max(600, "That is over 10 hours. Check the number."),
    completed: z.boolean(),
    correct_answers: z.coerce.number().int().min(0),
    total_questions: z.coerce.number().int().min(1, "Enter how many questions were asked."),
    sus_score: z
      .union([z.literal(""), z.coerce.number().min(0, "SUS is 0 to 100.").max(100, "SUS is 0 to 100.")])
      .optional(),
    notes: z.string().trim().max(600).optional(),
    consent_confirmed: z.literal(true, { message: "The participant must have consented to being included." }),
    is_demo: z.boolean(),
  })
  .refine((v) => v.correct_answers <= v.total_questions, {
    path: ["correct_answers"],
    message: "Correct answers cannot exceed the number of questions.",
  });
