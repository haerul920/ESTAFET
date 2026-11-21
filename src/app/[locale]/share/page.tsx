import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { WizardFrame, StepHeader } from "@/components/features/wizard/WizardFrame";
import { BasicsForm } from "@/components/features/wizard/BasicsForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "wizard" });
  return { title: tm("shareMeta") };
}

export default async function ShareNewPage() {
  await requireUser("/share");
  const t = await getTranslations("wizard");
  return (
    <WizardFrame projectId={null} current="basics">
      <StepHeader
        title={t("basicsTitle")}
        intro={t("newIntro")}
      />
      <BasicsForm project={null} />
    </WizardFrame>
  );
}
