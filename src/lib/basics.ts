import { z } from "zod";
import { PROJECT_KINDS } from "@/lib/db/types";
import type { TFn } from "@/lib/labels";

/**
 * The Info step of the share wizard. One set of rules for "Save and continue", the autosave and "Save and exit".
 *
 * Kind "other" ("Lainnya") needs the owner's own name for it in `kind_other` (CLAUDE.md 15.41). For the fixed kinds
 * `kind_other` is always null: the database has a check that keeps the two in step.
 */
export function basicsFields(v: TFn) {
  return {
    title: z.string().trim().min(3, v("titleMin")).max(120, v("titleMax")),
    kind: z.enum(PROJECT_KINDS, { message: v("kind") }),
    kind_other: z.string().trim().max(60, v("kindOtherMax")).optional(),
    field: z.string().trim().min(2, v("field")),
    year: z.coerce
      .number()
      .int()
      .min(2015, v("yearMin"))
      // A project that is being shared now cannot have started in a later year (QA note).
      .max(new Date().getFullYear(), v("yearMax")),
    stopped_note: z.string().trim().max(400, v("stoppedNoteMax")).optional(),
  };
}

/** The whole step at once: every field valid, and a name for "other". */
export function basicsSchema(v: TFn) {
  return z
    .object(basicsFields(v))
    .superRefine((d, ctx) => {
      if (d.kind === "other" && (d.kind_other ?? "").length < 2) {
        ctx.addIssue({ code: "custom", path: ["kind_other"], message: v("kindOtherMin") });
      }
    })
    .transform((d) => ({
      ...d,
      kind_other: d.kind === "other" ? (d.kind_other ?? "") : null,
      stopped_note: d.stopped_note ?? "",
    }));
}

/**
 * "Save and exit" saves the valid fields one by one. Kind and its name only make sense together, so this keeps a
 * patch consistent with the database check: "other" is saved only with a usable name (otherwise both are reported as
 * not saved), a fixed kind clears the name, and a name alone is never written without its kind.
 */
export function settleKind(patch: Record<string, string | number | null>, skipped: string[]): void {
  if (!("kind" in patch)) {
    delete patch.kind_other;
    return;
  }
  if (patch.kind !== "other") {
    patch.kind_other = null;
    return;
  }
  const name = typeof patch.kind_other === "string" ? patch.kind_other : "";
  if (name.length < 2) {
    delete patch.kind;
    delete patch.kind_other;
    for (const key of ["kind", "kind_other"]) if (!skipped.includes(key)) skipped.push(key);
  }
}

/** The name of a project's kind of work: the owner's own words for "other", the translated label otherwise. */
export function kindName(project: { kind: string; kind_other?: string | null }, kindLabels: Record<string, string>) {
  if (project.kind === "other" && project.kind_other) return project.kind_other;
  return kindLabels[project.kind] ?? project.kind;
}
