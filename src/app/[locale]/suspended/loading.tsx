import { PageShell } from "@/components/ui/PageShell";
import { Sk, SkButton, SkLines, SkStatus } from "@/components/ui/Skeleton";

/** Suspended notice: one centred warning panel with icon, title, text and the sign-out button. */
export default function Loading() {
  return (
    <PageShell width={620}>
      <SkStatus>
        <div className="flex flex-col items-center gap-3 rounded-[28px] bg-warn-bg p-10">
          <Sk className="h-10 w-10 rounded-full" />
          <Sk className="h-9 w-64 max-w-full" />
          <SkLines widths={[90, 70]} className="w-full items-center" />
          <SkButton width="w-36" className="mt-2" />
        </div>
      </SkStatus>
    </PageShell>
  );
}
