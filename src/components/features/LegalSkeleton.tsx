import { PageShell } from "@/components/ui/PageShell";
import { Sk, SkCard, SkLines, SkPageHeader, SkStatus } from "@/components/ui/Skeleton";

/**
 * Loading state of a legal page, in the LegalDocument layout: draft notice, title, lead, numbered sections and the
 * "other documents" links. `children` stands for extra content after the sections (the contact page).
 */
export function LegalSkeleton({ sections, children }: { sections: number; children?: React.ReactNode }) {
  return (
    <PageShell width={760}>
      <SkStatus>
        <SkCard tone="surface" className="mb-6 flex flex-col gap-2 !bg-warn-bg">
          <Sk className="h-5 w-40" />
          <SkLines widths={[100, 70]} />
        </SkCard>
        <SkPageHeader titleWidth="w-80" lead={[100, 100, 45]} />
        <div className="flex flex-col gap-6">
          {Array.from({ length: sections }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Sk className="h-6 w-60 max-w-full" />
              <SkLines widths={i % 2 ? [100, 96, 74] : [100, 88]} />
            </div>
          ))}
          {children}
        </div>
        <div className="mt-10 border-t border-line-soft pt-6">
          <Sk className="mb-3 h-5 w-36" />
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {[36, 28, 40, 32].map((w, i) => (
              <Sk key={i} className="h-5" style={{ width: `${w * 4}px` }} />
            ))}
          </div>
        </div>
      </SkStatus>
    </PageShell>
  );
}
