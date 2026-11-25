import { z } from "zod";

/** The documents an admin can write in the app. The contact page is not one of them. */
export const LEGAL_DOCS = ["terms", "privacy", "guidelines", "attribution"] as const;
export type LegalDocName = (typeof LEGAL_DOCS)[number];

export const LEGAL_PATHS: Record<LegalDocName, string> = {
  terms: "/terms",
  privacy: "/privacy",
  guidelines: "/pedoman",
  attribution: "/atribusi",
};

/** Sections that other pages link to (`/privacy#berkas`). They can be rewritten but not removed. */
export const FIXED_ANCHORS: Record<LegalDocName, readonly string[]> = {
  terms: ["syarat-terbit"],
  privacy: ["berkas", "publik"],
  guidelines: [],
  attribution: [],
};

export const MAX_SECTIONS = 30;

const section = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  h: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(8000),
});

const text = z.object({
  title: z.string().trim().min(3).max(120),
  lead: z.string().trim().min(1).max(600),
  sections: z
    .array(section)
    .min(1)
    .max(MAX_SECTIONS)
    .refine((list) => new Set(list.map((s) => s.id)).size === list.length),
});

export const legalContentSchema = z.object({ id: text, en: text });
export type LegalContent = z.infer<typeof legalContentSchema>;
export type LegalText = LegalContent["id"];
export type LegalSection = LegalText["sections"][number];

/** True when both languages still have every section other pages link to. */
export function hasFixedAnchors(doc: LegalDocName, content: LegalContent): boolean {
  return FIXED_ANCHORS[doc].every((anchor) =>
    [content.id, content.en].every((t) => t.sections.some((s) => s.id === anchor)),
  );
}

/** The id of a section on the page. Fixed anchors keep their own name, so links to them keep working. */
export function sectionAnchor(doc: LegalDocName, id: string): string {
  return FIXED_ANCHORS[doc].includes(id) ? id : `${doc}-${id}`;
}
