import { useTranslations } from "next-intl";
import { Breadcrumb, PageShell } from "@/components/ui/PageShell";
import { Stepper } from "@/components/ui/Stepper";

// Order (R4): info, files, review the AI draft, team and access, preview and publish.
export const WIZARD_STEPS = ["info", "berkas", "tinjau", "tim", "terbit"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];
const LABEL_KEY = {
  info: "stepBasics",
  berkas: "stepFiles",
  tinjau: "stepVerify",
  tim: "stepConsent",
  terbit: "stepPublish",
} as const;

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
      <Breadcrumb items={[{ label: t("breadcrumbDashboard"), href: "/dasbor" }, { label: t("shareMeta") }]} />
      <Stepper
        label={t("frameLabel")}
        current={index}
        steps={WIZARD_STEPS.map((s) => ({
          label: t(LABEL_KEY[s]),
          href: projectId ? `/bagikan/${projectId}/${s}` : undefined,
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
