import { describe, expect, it } from "vitest";
import { hasFixedAnchors, LEGAL_DOCS, legalContentSchema, sectionAnchor } from "@/lib/legal/content";
import { defaultContent } from "@/lib/legal/defaults";
import { parseBlocks, parseInline } from "@/lib/legal/markup";

describe("legal documents", () => {
  it("has built-in text for every document, valid in both languages, with the linked sections", () => {
    for (const doc of LEGAL_DOCS) {
      const content = defaultContent(doc);
      expect(legalContentSchema.safeParse(content).success, doc).toBe(true);
      expect(hasFixedAnchors(doc, content), doc).toBe(true);
      expect(content.id.sections.map((s) => s.id)).toEqual(content.en.sections.map((s) => s.id));
    }
  });

  it("keeps the anchors other pages link to", () => {
    expect(sectionAnchor("privacy", "berkas")).toBe("berkas");
    expect(sectionAnchor("terms", "syarat-terbit")).toBe("syarat-terbit");
    expect(sectionAnchor("privacy", "s1")).toBe("privacy-s1");
    const content = defaultContent("privacy");
    content.en.sections = content.en.sections.filter((s) => s.id !== "publik");
    expect(hasFixedAnchors("privacy", content)).toBe(false);
  });

  it("refuses empty parts and repeated section ids", () => {
    const content = defaultContent("guidelines");
    content.id.sections[0].body = "   ";
    expect(legalContentSchema.safeParse(content).success).toBe(false);
    const twice = defaultContent("guidelines");
    twice.id.sections[1].id = twice.id.sections[0].id;
    expect(legalContentSchema.safeParse(twice).success).toBe(false);
  });

  it("reads paragraphs, lists, bold and code, and leaves HTML as plain text", () => {
    expect(parseBlocks("One\nTwo\n\n- a\n- b\nAfter")).toEqual([
      { type: "p", lines: ["One", "Two"] },
      { type: "ul", items: ["a", "b"] },
      { type: "p", lines: ["After"] },
    ]);
    expect(parseInline("**Read:** the `.env` file <script>x</script>")).toEqual([
      { type: "bold", value: "Read:" },
      { type: "text", value: " the " },
      { type: "code", value: ".env" },
      { type: "text", value: " file <script>x</script>" },
    ]);
  });
});
