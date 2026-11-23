import { LegalSkeleton } from "@/components/features/LegalSkeleton";
import { Sk, SkCard, SkLines } from "@/components/ui/Skeleton";

/** Contact: the legal layout with the contact card and two short sections. */
export default function Loading() {
  return (
    <LegalSkeleton sections={0}>
      <SkCard className="flex flex-col gap-2">
        <SkLines widths={[80, 50]} />
      </SkCard>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <Sk className="h-6 w-56" />
          <SkLines widths={[90, 75, 60]} />
        </div>
      ))}
    </LegalSkeleton>
  );
}
