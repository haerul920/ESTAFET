import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHeader } from "@/components/admin/ui";
import { PolicyEditor } from "@/components/admin/PolicyEditor";
import { LEGAL_DOCS, type LegalDocName } from "@/lib/legal/content";
import { getLegalDocument } from "@/lib/legal/load";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.policies" });
  return { title: t("title") };
}

export default async function AdminPolicyEditorPage({ params }: { params: Promise<{ doc: string }> }) {
  await requireAdmin();
  const { doc } = await params;
  if (!(LEGAL_DOCS as readonly string[]).includes(doc)) notFound();
  const name = doc as LegalDocName;
  const [t, current] = await Promise.all([getTranslations("admin.policies"), getLegalDocument(name)]);
  const names: Record<LegalDocName, string> = {
    terms: t("terms"),
    privacy: t("privacy"),
    guidelines: t("guidelines"),
    attribution: t("attribution"),
  };
  return (
    <>
      <PageHeader title={t("editorTitle", { name: names[name] })} intro={t("editorIntro")} />
      {/* A new revision gives a new key, so the editor starts again from what is now published. */}
      <PolicyEditor key={current.revision} doc={name} initial={current.content} />
    </>
  );
}
