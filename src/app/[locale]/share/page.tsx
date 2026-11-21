import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { WizardFrame, StepHeader } from "@/components/features/wizard/WizardFrame";
import { BasicsForm } from "@/components/features/wizard/BasicsForm";

export const metadata: Metadata = { title: "Share a project" };

export default async function ShareNewPage() {
  await requireUser("/share");
  return (
    <WizardFrame projectId={null} current="basics">
      <StepHeader
        title="Tell us about your project"
        intro="Start with the basics. ESTAFET saves a private draft when you continue, and you can come back from your dashboard at any time."
      />
      <BasicsForm project={null} />
    </WizardFrame>
  );
}
