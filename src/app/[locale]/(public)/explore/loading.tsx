import { PageShell } from "@/components/ui/PageShell";
import { Sk, SkCard, SkChip, SkField, SkLines, SkPageHeader, SkStatus } from "@/components/ui/Skeleton";

function FilterGroup({ legend, options }: { legend: string; options: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <Sk className={`mb-1 h-5 ${legend}`} />
      {options.map((w, i) => (
        <div key={i} className="flex min-h-[32px] items-center gap-2">
          <Sk className="h-[18px] w-[18px] flex-none rounded" />
          <Sk className={`h-4 ${w}`} />
        </div>
      ))}
    </div>
  );
}

function CardShape() {
  return (
    <SkCard className="flex min-h-[260px] flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <Sk className="h-4 w-32" />
        <SkChip width="w-16" />
      </div>
      <Sk className="h-6 w-4/5" />
      <SkLines widths={[100, 90, 60]} />
      <div className="flex gap-2">
        <SkChip width="w-24" />
        <SkChip width="w-20" />
      </div>
      <div className="mt-auto flex flex-col gap-1.5 pt-2">
        <div className="flex justify-between">
          <Sk className="h-3 w-24" />
          <Sk className="h-3 w-10" />
        </div>
        <Sk className="h-1.5 w-full rounded-full" />
      </div>
    </SkCard>
  );
}

/** Explore: title, search and sort, the filter sidebar, the result count and the project cards. */
export default function Loading() {
  return (
    <PageShell width={1120}>
      <SkStatus>
        <SkPageHeader size="lg" titleWidth="w-72" lead={[50]} className="mb-6" />
        <div className="flex flex-col gap-8">
          <div className="flex flex-wrap gap-3">
            <SkField label="w-24" className="flex-[1_1_320px]" />
            <SkField label="w-16" className="flex-[0_1_220px]" />
          </div>
          <div className="flex flex-wrap items-start gap-8">
            <div className="flex flex-[0_0_240px] flex-col gap-6 max-md:flex-[1_1_100%]">
              <FilterGroup legend="w-32" options={["w-36", "w-24", "w-28"]} />
              <FilterGroup legend="w-36" options={["w-40", "w-32", "w-36", "w-20"]} />
              <FilterGroup legend="w-20" options={["w-44", "w-36", "w-40"]} />
            </div>
            <div className="min-w-0 flex-[1_1_560px]">
              <Sk className="mb-4 h-4 w-20" />
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <CardShape key={i} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </SkStatus>
    </PageShell>
  );
}
