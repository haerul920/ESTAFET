import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { LegalArticle } from "./LegalArticle";
import type { LegalDocName } from "@/lib/legal/content";
import { getLegalDocument } from "@/lib/legal/load";

export type LegalDoc = LegalDocName | "contact";

const DOCS = [
  { doc: "terms", href: "/terms", label: "docTerms" },
  { doc: "privacy", href: "/privacy", label: "docPrivacy" },
  { doc: "guidelines", href: "/pedoman", label: "docGuidelines" },
  { doc: "attribution", href: "/atribusi", label: "docAttribution" },
  { doc: "contact", href: "/kontak", label: "docContact" },
] as const;

async function Written({ doc }: { doc: LegalDocName }) {
  const [locale, current] = await Promise.all([getLocale(), getLegalDocument(doc)]);
  return <LegalArticle doc={doc} text={current.content[locale === "en" ? "en" : "id"]} />;
}

async function Contact() {
  const t = await getTranslations("legal.contact");
  return (
    <>
      <h1 className="mb-3 mt-0 text-[36px] font-medium max-sm:text-[28px]">{t("title")}</h1>
      <p className="mb-8 mt-0 text-lg text-text-2">{t("lead")}</p>
    </>
  );
}

/**
 * One legal page with links to the others. The four documents show the newest text an admin published (or the built-in
 * text). The contact page is fixed and passes its own content as children.
 */
export async function LegalDocument({ doc, children }: { doc: LegalDoc; children?: React.ReactNode }) {
  const tl = await getTranslations("legal");
  return (
    <PageShell width={760}>
      {doc === "contact" ? <Contact /> : <Written doc={doc} />}
      {children ? <div className="flex flex-col gap-6 text-[16px] leading-relaxed">{children}</div> : null}
      <nav aria-label={tl("otherDocs")} className="mt-10 border-t border-line-soft pt-6">
        <h2 className="mb-2 mt-0 text-base">{tl("otherDocs")}</h2>
        <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
          {DOCS.filter((d) => d.doc !== doc).map((d) => (
            <li key={d.doc}>
              <Link href={d.href} className="link-anim font-semibold text-blue">
                {tl(d.label)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </PageShell>
  );
}

export async function legalMetadata(locale: string, doc: LegalDoc) {
  const tm = await getTranslations({ locale, namespace: `legal.${doc}` });
  return { title: tm("metaTitle"), robots: { index: false } };
}
