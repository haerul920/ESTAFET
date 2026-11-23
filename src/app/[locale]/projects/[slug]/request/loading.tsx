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
  SkPageHeader,
  SkStatus,
} from "@/components/ui/Skeleton";

function Group({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <SkCard className="flex flex-col gap-4">
      <Sk className={`h-6 ${legend}`} />
      {children}
    </SkCard>
  );
}

/** Request to continue: three form groups (team, tasks, plan), the agreement box and the side cards. */
export default function Loading() {
  return (
    <PageShell>
      <SkStatus>
        <SkBreadcrumb width="w-80" />
        <SkPageHeader titleWidth="w-96" lead={[100, 60]} />
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-6">
            <Group legend="w-32">
              <SkField label="w-28" />
              <SkField label="w-40" />
            </Group>
            <Group legend="w-44">
              <SkCheck widths={[70]} />
              <SkCheck widths={[55]} />
              <SkCheck widths={[65]} />
            </Group>
            <Group legend="w-36">
              <SkField label="w-24" tall />
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
                <SkField label="w-20" />
                <SkField label="w-28" />
              </div>
              <SkField label="w-32" tall />
            </Group>
            <div className="rounded-[28px] bg-warn-bg p-5">
              <SkCheck widths={[95, 60]} />
            </div>
            <div className="flex flex-wrap gap-3">
              <SkButton width="w-48" />
              <SkButton width="w-28" />
            </div>
          </div>
          <div className="flex min-w-[260px] flex-[0_1_340px] flex-col gap-4">
            <SkCard className="flex flex-col gap-3">
              <Sk className="h-6 w-48" />
              <Sk className="h-4 w-40" />
              <SkChip width="w-36" />
            </SkCard>
            <SkCard className="flex flex-col gap-4">
              <Sk className="h-5 w-36" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Sk className="h-6 w-6 flex-none rounded-full" />
                  <SkLines widths={[90, 60]} className="flex-1" />
                </div>
              ))}
            </SkCard>
          </div>
        </div>
      </SkStatus>
    </PageShell>
  );
}
