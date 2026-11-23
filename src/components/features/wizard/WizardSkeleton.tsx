import { PageShell } from "@/components/ui/PageShell";
import {
  Sk,
  SkBreadcrumb,
  SkButton,
  SkCard,
  SkField,
  SkLines,
  SkPageHeader,
  SkStatus,
  SkStepper,
} from "@/components/ui/Skeleton";

/** The wizard frame (breadcrumb, five-step stepper, step title) around a step's content. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <SkStatus>
        <SkBreadcrumb width="w-48" />
        <SkStepper />
        <SkPageHeader titleWidth="w-72" lead={[70, 45]} className="mb-6" />
        {children}
      </SkStatus>
    </PageShell>
  );
}

/** Step 1 (Info): the basics form. */
export function WizardBasicsSkeleton() {
  return (
    <Frame>
      <div className="flex max-w-[760px] flex-col gap-5">
        <SkField label="w-28" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
          <SkField label="w-20" />
          <SkField label="w-24" />
          <SkField label="w-16" />
        </div>
        <SkField label="w-36" />
        <SkField label="w-44" tall />
        <SkButton size="lg" width="w-48" />
      </div>
    </Frame>
  );
}

/**
 * Steps 2 to 5 (Team, Files, Review, Publish) share one loading file, so this is their common shape:
 * a main card with a list and a side card.
 */
export function WizardStepSkeleton() {
  return (
    <Frame>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-4">
          <SkCard className="flex flex-col gap-4">
            <Sk className="h-6 w-52" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-line-soft pb-3">
                <SkLines widths={[60, 40]} className="flex-1" />
                <Sk className="h-7 w-24 rounded-full" />
              </div>
            ))}
          </SkCard>
          <SkButton size="lg" width="w-52" />
        </div>
        <SkCard className="flex min-w-[260px] flex-[0_1_340px] flex-col gap-3">
          <Sk className="h-5 w-36" />
          <SkLines widths={[100, 90, 70]} />
        </SkCard>
      </div>
    </Frame>
  );
}
