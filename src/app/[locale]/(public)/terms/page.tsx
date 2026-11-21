import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "terms" });
  return { title: tm("metaTitle"), robots: { index: false } };
}

/** Interim version 1 of the Terms. The full text is written in phase R5 and reviewed by the university before any public launch. */
export default async function TermsPage() {
  const t = await getTranslations("terms");
  return (
    <PageShell width={760}>
      <Card tone="warn" className="mb-6">
        <strong>{t("draft")}</strong>
      </Card>
      <h1 className="mb-4 mt-0 text-[36px] font-medium">{t("title")}</h1>
      <div className="flex flex-col gap-4 text-[16px] leading-relaxed">
        <p className="m-0">{t("intro")}</p>
        <ul className="m-0 flex flex-col gap-2 pl-5">
          {(["l1", "l2", "l3", "l4", "l5"] as const).map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
        <p className="m-0 text-text-2">{t("note")}</p>
      </div>
    </PageShell>
  );
}
