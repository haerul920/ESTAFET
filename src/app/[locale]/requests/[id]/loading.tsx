import { PageShell } from "@/components/ui/PageShell";
import {
  Sk,
  SkBreadcrumb,
  SkButton,
  SkCard,
  SkCheck,
  SkChip,
  SkField,
  SkLines,
  SkStatus,
} from "@/components/ui/Skeleton";

/** Request review: title and status, the request stepper, the request card and decision, agreement on the side. */
export default function Loading() {
  return (
    <PageShell>
      <SkStatus>
        <SkBreadcrumb width="w-72" />
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
            <Sk className="h-10 w-80 max-w-full max-sm:h-8" />
            <Sk className="h-4 w-[28rem] max-w-full" />
          </div>
          <SkChip width="w-28" />
        </div>
        <div className="mb-8 flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex min-w-[130px] flex-1 flex-col gap-2">
              <Sk className="h-1.5 rounded-full" />
              <Sk className="h-4 w-24" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-6">
            <SkCard className="flex flex-col gap-4">
              <Sk className="h-6 w-48" />
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((i) => (
                  <Sk key={i} className="h-9 w-9 rounded-full" />
                ))}
                <Sk className="ml-2 h-4 w-20" />
              </div>
              <div className="flex flex-wrap gap-2">
                <SkChip width="w-40" />
                <SkChip width="w-32" />
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
                {[0, 1, 2].map((i) => (
                  <SkLines key={i} widths={[50, 80]} />
                ))}
              </div>
              <SkLines widths={[100, 90, 60]} />
            </SkCard>
            <SkCard className="flex flex-col gap-4">
              <Sk className="h-6 w-40" />
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <SkChip key={i} width="w-28" />
                ))}
              </div>
              <SkField label="w-28" tall />
              <div className="flex flex-wrap gap-3">
                <SkButton width="w-28" />
                <SkButton width="w-32" />
                <SkButton width="w-24" />
              </div>
            </SkCard>
          </div>
          <div className="flex min-w-[280px] flex-[0_1_400px] flex-col gap-4">
            <SkCard className="flex flex-col gap-3">
              <Sk className="h-6 w-44" />
              <SkLines widths={[100, 90, 70]} />
              <SkCheck widths={[90, 50]} />
              <SkButton width="w-44" />
            </SkCard>
            <SkCard className="flex flex-col gap-3">
              <Sk className="h-5 w-32" />
              <Sk className="h-16 w-full rounded-[14px]" />
            </SkCard>
          </div>
        </div>
      </SkStatus>
    </PageShell>
  );
}
