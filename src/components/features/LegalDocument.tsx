import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";

export type LegalDoc = "terms" | "privacy" | "guidelines" | "attribution" | "contact";

const DOCS = [
  { doc: "terms", href: "/terms", label: "docTerms" },
  { doc: "privacy", href: "/privacy", label: "docPrivacy" },
  { doc: "guidelines", href: "/pedoman", label: "docGuidelines" },
  { doc: "attribution", href: "/atribusi", label: "docAttribution" },
  { doc: "contact", href: "/kontak", label: "docContact" },
] as const;

/**
 * One legal page. The text lives in messages (`legal.<doc>.s1.h` and `.p`, up to `sections`), the draft banner is shared.
 * Every page says plainly that it is a draft that has not been reviewed by the competent authority.
 */
export async function LegalDocument({
  doc,
  sections,
  children,
}: {
  doc: LegalDoc;
  sections: number;
  children?: React.ReactNode;
}) {
  const [t, tl] = await Promise.all([getTranslations(`legal.${doc}`), getTranslations("legal")]);
  const dynamic = t as unknown as (key: string) => string;
  return (
    <PageShell width={760}>
      <Card tone="warn" className="mb-6 flex flex-col gap-1" role="note">
        <strong>{tl("draftTitle")}</strong>
        <span className="text-[15px]">{tl("draftText")}</span>
      </Card>
      <h1 className="mb-3 mt-0 text-[36px] font-medium max-sm:text-[28px]">{t("title")}</h1>
      <p className="mb-8 mt-0 text-lg text-text-2">{t("lead")}</p>
      <div className="flex flex-col gap-6 text-[16px] leading-relaxed">
        {Array.from({ length: sections }, (_, i) => `s${i + 1}`).map((k) => (
          <section key={k} aria-labelledby={`${doc}-${k}`}>
            <h2 id={`${doc}-${k}`} className="mb-1 mt-0 text-xl">
              {dynamic(`${k}.h`)}
            </h2>
            <p className="m-0">{dynamic(`${k}.p`)}</p>
          </section>
        ))}
        {children}
      </div>
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
