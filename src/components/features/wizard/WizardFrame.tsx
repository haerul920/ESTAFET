import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui/PageShell";
import { Stepper } from "@/components/ui/Stepper";

export const WIZARD_STEPS = ["basics", "consent", "files", "verify", "publish"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];
const LABEL_KEY = { basics: "stepBasics", consent: "stepConsent", files: "stepFiles", verify: "stepVerify", publish: "stepPublish" } as const;

export function WizardFrame({
  projectId,
  current,
  children,
}: {
  projectId: string | null;
  current: WizardStep;
  children: React.ReactNode;
}) {
  const t = useTranslations("wizard");
  const index = WIZARD_STEPS.indexOf(current);
  return (
    <PageShell>
      <Stepper
        label={t("frameLabel")}
        current={index}
        steps={WIZARD_STEPS.map((s) => ({
          label: t(LABEL_KEY[s]),
          href: projectId ? `/share/${projectId}/${s}` : undefined,
        }))}
      />
      {children}
    </PageShell>
  );
}

export function StepHeader({ title, intro }: { title: string; intro: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="mb-2 mt-0 text-4xl font-medium max-sm:text-[28px]">{title}</h1>
      <p className="m-0 max-w-[680px] text-text-2">{intro}</p>
    </div>
  );
}
