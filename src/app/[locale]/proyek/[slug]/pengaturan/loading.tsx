import { PageShell } from "@/components/ui/PageShell";
import { Sk, SkBreadcrumb, SkButton, SkCard, SkChip, SkLines, SkStatus } from "@/components/ui/Skeleton";

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <SkCard className="flex flex-col gap-4">
      <Sk className={`h-6 ${heading}`} />
      {children}
    </SkCard>
  );
}

/** Project settings: publication, file access (mode cards and team limit), team, incoming requests. */
export default function Loading() {
  return (
    <PageShell width={880}>
      <SkStatus>
        <SkBreadcrumb width="w-72" />
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <Sk className="h-10 w-72 max-w-full max-sm:h-8" />
            <Sk className="h-4 w-[28rem] max-w-full" />
          </div>
          <SkButton width="w-48" />
        </div>
        <div className="flex flex-col gap-6">
          <Section heading="w-36">
            <div className="flex flex-wrap items-center gap-3">
              <SkChip width="w-28" />
              <Sk className="h-4 w-64 max-w-full" />
            </div>
            <div className="flex flex-wrap gap-3">
              <SkButton width="w-32" />
              <SkButton width="w-28" />
            </div>
          </Section>
          <Section heading="w-44">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col gap-2 rounded-[18px] bg-white p-4">
                  <Sk className="h-5 w-28" />
                  <SkLines widths={[100, 70]} />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <SkChip width="w-12" />
              <SkChip width="w-12" />
              <SkChip width="w-24" />
            </div>
            <SkButton width="w-24" />
          </Section>
          <Section heading="w-28">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-line-soft pb-3">
                <div className="flex items-center gap-3">
                  <Sk className="h-9 w-9 rounded-full" />
                  <Sk className="h-4 w-40" />
                </div>
                <SkChip width="w-20" />
              </div>
            ))}
          </Section>
          <Section heading="w-48">
            <SkLines widths={[60]} />
          </Section>
        </div>
      </SkStatus>
    </PageShell>
  );
}
