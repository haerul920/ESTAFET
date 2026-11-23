import { PageShell } from "@/components/ui/PageShell";
import { Sk, SkBreadcrumb, SkCard, SkChip, SkLines, SkPageHeader, SkStatus } from "@/components/ui/Skeleton";

/** Moderation decisions: current state card, the latest decision with its reason, and the history. */
export default function Loading() {
  return (
    <PageShell width={820}>
      <SkStatus>
        <SkBreadcrumb width="w-72" />
        <SkPageHeader titleWidth="w-72" lead={[90]} className="mb-6" />
        <div className="flex flex-col gap-6">
          <SkCard className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <Sk className="h-6 w-56" />
              <SkChip width="w-24" />
            </div>
            <SkLines widths={[90, 60]} />
          </SkCard>
          <SkCard className="flex flex-col gap-3">
            <Sk className="h-6 w-44" />
            <SkLines widths={[100, 85, 50]} />
            <Sk className="h-4 w-48" />
          </SkCard>
          <SkCard className="flex flex-col gap-3">
            <Sk className="h-5 w-32" />
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-2 border-b border-line-soft pb-3">
                <Sk className="h-4 w-40" />
                <SkLines widths={[80]} />
              </div>
            ))}
          </SkCard>
        </div>
      </SkStatus>
    </PageShell>
  );
}
