import { z } from "zod";

/** Validation for a recorded onboarding trial session. Messages are codes: the admin action turns them into text (messages admin.validation.*). Pseudonym codes only: no names, no emails. */
export const trialSchema = z
  .object({
    id: z.string().uuid().optional().or(z.literal("")),
    participant_code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{1,12}$/, "pseudonym"),
    cohort: z.enum(["baseline", "estafet"], { message: "cohort" }),
    project_id: z.string().uuid().optional().or(z.literal("")),
    started_at: z.string().min(1, "start"),
    minutes_to_understand: z.coerce.number().min(0, "minutes_neg").max(600, "minutes_big"),
    completed: z.boolean(),
    correct_answers: z.coerce.number().int().min(0),
    total_questions: z.coerce.number().int().min(1, "questions_min"),
    sus_score: z.union([z.literal(""), z.coerce.number().min(0, "sus").max(100, "sus")]).optional(),
    notes: z.string().trim().max(600).optional(),
    consent_confirmed: z.literal(true, { message: "consent" }),
    is_demo: z.boolean(),
  })
  .refine((v) => v.correct_answers <= v.total_questions, {
    path: ["correct_answers"],
    message: "correct_exceeds",
  });
