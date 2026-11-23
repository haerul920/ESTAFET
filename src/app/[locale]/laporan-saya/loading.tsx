import { PageShell } from "@/components/ui/PageShell";
import { Sk, SkCard, SkChip, SkLines, SkPageHeader, SkStatus } from "@/components/ui/Skeleton";

/** My reports: title, lead, then a list of report cards (status badge, explanation, meta line). */
export default function Loading() {
  return (
    <PageShell width={820}>
      <SkStatus>
        <SkPageHeader titleWidth="w-56" lead={[100, 60]} className="mb-6" />
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <SkCard key={i} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Sk className="h-6 w-56" />
                <SkChip width="w-24" />
              </div>
              <SkLines widths={[90]} />
              <Sk className="h-4 w-64 max-w-full" />
            </SkCard>
          ))}
        </div>
      </SkStatus>
    </PageShell>
  );
}
