import { PageShell } from "@/components/ui/PageShell";
import { Sk, SkButton, SkCard, SkChip, SkPageHeader, SkStatus } from "@/components/ui/Skeleton";

function ProjectRow() {
  return (
    <SkCard className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Sk className="h-7 w-72 max-w-full" />
          <div className="flex flex-wrap items-center gap-2">
            <SkChip width="w-24" />
            <Sk className="h-4 w-40" />
          </div>
        </div>
        <SkButton width="w-36" />
      </div>
      <Sk className="h-4 w-36" />
    </SkCard>
  );
}

function SectionHead({ heading }: { heading: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Sk className={`h-8 ${heading}`} />
      <SkButton width="w-40" />
    </div>
  );
}

/** Dashboard: title, three number tiles, "Proyek saya" with project rows, "Proyek yang saya lanjutkan". */
export default function Loading() {
  return (
    <PageShell>
      <SkStatus>
        <SkPageHeader size="lg" titleWidth="w-44" lead={[45]} />
        <div className="flex flex-col gap-10">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
            {["bg-warn-bg", "bg-blue-tint", "bg-surface"].map((bg) => (
              <div key={bg} className={`sk-surface flex flex-col gap-3 rounded-[28px] p-5 ${bg}`}>
                <Sk className="h-9 w-12" />
                <Sk className="h-5 w-40" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <SectionHead heading="w-40" />
            <ProjectRow />
            <ProjectRow />
          </div>
          <div className="flex flex-col gap-4">
            <SectionHead heading="w-72 max-w-full" />
            <SkCard className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-2">
                <Sk className="h-6 w-56" />
                <Sk className="h-4 w-40" />
              </div>
              <SkButton width="w-36" />
            </SkCard>
          </div>
        </div>
      </SkStatus>
    </PageShell>
  );
}
