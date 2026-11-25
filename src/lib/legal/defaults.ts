import idMessages from "../../../messages/id.json";
import enMessages from "../../../messages/en.json";
import type { LegalContent, LegalDocName, LegalSection, LegalText } from "./content";

/** The text built into the app: what a page shows until an admin publishes a first revision. */
function fromMessages(doc: LegalDocName, messages: typeof idMessages): LegalText {
  const source = messages.legal[doc] as unknown as Record<string, { h: string; p: string } | string>;
  const sections: LegalSection[] = Object.keys(source)
    .filter((key) => /^s\d+$/.test(key))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    .map((key) => {
      const s = source[key] as { h: string; p: string };
      return { id: key, h: s.h, body: s.p };
    });

  if (doc === "privacy") {
    const x = messages.legalExtras.privacy;
    const skipped = x.skippedText.replace(/<\/?env>/g, "`");
    sections.push(
      {
        id: "berkas",
        h: x.filesTitle,
        body: [
          `- **${x.readLabel}** ${x.readText}`,
          `- **${x.whoLabel}** ${x.whoText}`,
          `- **${x.privateLabel}** ${x.privateText}`,
          `- **${x.skippedLabel}** ${skipped}`,
          "",
          x.cancelText,
        ].join("\n"),
      },
      { id: "publik", h: x.publicTitle, body: x.publicText },
    );
  }
  if (doc === "terms") {
    const x = messages.legalExtras.terms;
    sections.push({
      id: "syarat-terbit",
      h: x.title,
      body: [x.intro, "", ...[x.basics, x.team, x.review, x.kept, x.policies].map((line) => `- ${line}`)].join("\n"),
    });
  }
  return { title: source.title as string, lead: source.lead as string, sections };
}

export function defaultContent(doc: LegalDocName): LegalContent {
  return { id: fromMessages(doc, idMessages), en: fromMessages(doc, enMessages as typeof idMessages) };
}
