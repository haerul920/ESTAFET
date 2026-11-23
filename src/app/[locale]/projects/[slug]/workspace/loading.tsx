import { PageShell } from "@/components/ui/PageShell";
import { Sk, SkBreadcrumb, SkButton, SkCard, SkChip, SkLines, SkStatus } from "@/components/ui/Skeleton";

/** Workspace: title with the private badge; private files, then the full backlog groups; lineage on the side. */
export default function Loading() {
  return (
    <PageShell>
      <SkStatus>
        <SkBreadcrumb width="w-72" />
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <SkChip width="w-32" />
            <Sk className="h-11 w-[30rem] max-w-full max-sm:h-8" />
          </div>
          <Sk className="h-11 w-11 rounded-full" />
        </div>
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-6">
            <SkCard className="flex flex-col gap-3">
              <Sk className="h-6 w-36" />
              <Sk className="mb-1 h-4 w-72 max-w-full" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-[18px] bg-white p-3">
                  <div className="flex items-center gap-3">
                    <Sk className="h-5 w-5 rounded" />
                    <Sk className="h-4 w-48" />
                  </div>
                  <SkButton width="w-28" />
                </div>
              ))}
            </SkCard>
            {[0, 1].map((g) => (
              <SkCard key={g} className="flex flex-col gap-3">
                <Sk className="h-6 w-44" />
                {[0, 1].map((i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-[18px] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Sk className="h-5 w-1/2" />
                      <SkChip width="w-32" />
                    </div>
                    <SkLines widths={[95, 70]} />
                  </div>
                ))}
              </SkCard>
            ))}
          </div>
          <div className="flex min-w-[280px] flex-[0_1_380px] flex-col gap-4">
            <SkCard className="flex flex-col gap-3">
              <Sk className="h-5 w-32" />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Sk className="h-3 w-3 flex-none rounded-full" />
                  <SkLines widths={[70, 45]} className="flex-1" />
                </div>
              ))}
            </SkCard>
            <div className="flex flex-col gap-3 rounded-[28px] bg-blue-tint p-6">
              <Sk className="h-5 w-40" />
              <SkLines widths={[100, 80]} />
            </div>
          </div>
        </div>
      </SkStatus>
    </PageShell>
  );
}
