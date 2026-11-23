import { PageShell } from "@/components/ui/PageShell";
import { Sk, SkCard, SkLines, SkPageHeader, SkStatus } from "@/components/ui/Skeleton";

/** First-run screen: title, lead, two large choice cards, and the skip link. */
export default function Loading() {
  return (
    <PageShell width={880}>
      <SkStatus>
        <SkPageHeader size="lg" titleWidth="w-[26rem]" lead={[90, 50]} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5">
          {[0, 1].map((i) => (
            <SkCard key={i} className="flex min-h-[260px] flex-col gap-3 p-7">
              <Sk className="h-12 w-12 rounded-full" />
              <Sk className="h-7 w-44" />
              <SkLines widths={[100, 80]} />
              <Sk className="mt-auto h-5 w-24" />
            </SkCard>
          ))}
        </div>
        <Sk className="mt-8 h-4 w-40" />
      </SkStatus>
    </PageShell>
  );
}
