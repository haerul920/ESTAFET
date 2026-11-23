import { PageShell } from "@/components/ui/PageShell";
import { Sk, SkBreadcrumb, SkButton, SkCard, SkCheck, SkChip, SkLines, SkStatus } from "@/components/ui/Skeleton";

/**
 * Project teaser: breadcrumb, badges, title, meta line; main column (what it is, where it stands, next tasks,
 * lessons, locked files) and the side column (call to action, tech, lineage).
 */
export default function Loading() {
  return (
    <PageShell>
      <SkStatus>
        <div className="mb-4 flex items-center justify-between gap-3">
          <SkBreadcrumb width="w-56" />
          <Sk className="mb-4 h-11 w-11 rounded-full" />
        </div>
        <div className="mb-8">
          <div className="mb-3 flex gap-2">
            <SkChip width="w-36" />
          </div>
          <Sk className="mb-3 h-12 w-[36rem] max-w-full max-sm:h-9" />
          <Sk className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-6">
            <SkCard className="flex flex-col gap-3">
              <Sk className="h-6 w-40" />
              <SkLines widths={[100, 96, 80]} />
            </SkCard>
            <SkCard className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-3">
                <Sk className="h-6 w-48" />
                <Sk className="h-4 w-20" />
              </div>
              <Sk className="h-2 w-full rounded-full" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3 border-b border-line-soft pb-3">
                  <Sk className="h-5 w-2/3" />
                  <SkChip width="w-24" />
                </div>
              ))}
            </SkCard>
            <SkCard className="flex flex-col gap-3">
              <Sk className="h-6 w-56" />
              <Sk className="mb-1 h-4 w-80 max-w-full" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col gap-2 rounded-[18px] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Sk className="h-5 w-1/2" />
                    <SkChip width="w-16" />
                  </div>
                  <SkLines widths={[90, 60]} />
                </div>
              ))}
            </SkCard>
            <SkCard tone="dashed" className="flex items-start gap-4">
              <Sk className="h-7 w-7 flex-none rounded-md" />
              <SkLines widths={[40, 90]} className="flex-1" />
            </SkCard>
          </div>
          <div className="flex min-w-[260px] flex-[0_1_320px] flex-col gap-4">
            <SkCard className="flex flex-col gap-3">
              <Sk className="h-6 w-44" />
              <SkLines widths={[100, 80]} />
              <SkCheck widths={[90, 50]} />
              <SkButton width="w-full" />
            </SkCard>
            <SkCard className="flex flex-col gap-3">
              <Sk className="h-5 w-28" />
              <div className="flex flex-wrap gap-2">
                <SkChip width="w-20" />
                <SkChip width="w-16" />
                <SkChip width="w-24" />
              </div>
            </SkCard>
            <SkCard className="flex flex-col gap-3">
              <Sk className="h-5 w-32" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Sk className="h-3 w-3 flex-none rounded-full" />
                  <SkLines widths={[70, 45]} className="flex-1" />
                </div>
              ))}
            </SkCard>
          </div>
        </div>
      </SkStatus>
    </PageShell>
  );
}
