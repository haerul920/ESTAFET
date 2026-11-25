import { cn } from "@/lib/cn";

/** Pieces used by more than one loading skeleton. No hooks, so server and client files can both use them. */
export function BreadcrumbBar({ parts = 2 }: { parts?: 2 | 3 }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="skeleton h-4 w-24 rounded-full" />
      <div className="skeleton h-3 w-3 rounded-full" />
      <div className="skeleton h-4 w-36 rounded-full" />
      {parts === 3 ? (
        <>
          <div className="skeleton h-3 w-3 rounded-full" />
          <div className="skeleton h-4 w-28 rounded-full" />
        </>
      ) : null}
    </div>
  );
}

/** The stepper: a line over each step, then its number and name. `current` is 1 for the first step. */
export function StepperBar({ steps = 5, current = 1 }: { steps?: number; current?: number }) {
  return (
    <div className="mb-8 grid gap-2" style={{ gridTemplateColumns: `repeat(${steps}, minmax(0, 1fr))` }}>
      {Array.from({ length: steps }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className={cn("h-1.5 w-full rounded-full", i < current ? "bg-blue/45" : "skeleton")} />
          <div className="flex items-center gap-2">
            <div className={cn("h-6 w-6 flex-none rounded-full", i < current ? "bg-blue/45" : "skeleton")} />
            <div className="skeleton h-3.5 w-20 max-w-full rounded-full max-sm:hidden" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TextLines({ widths, strong = true }: { widths: string[]; strong?: boolean }) {
  return (
    <>
      {widths.map((w, i) => (
        <div key={i} className={cn(strong ? "skeleton-strong" : "skeleton", "h-4", w)} />
      ))}
    </>
  );
}

/** One labelled form field. */
export function FieldShape({ label = "w-28", box = "h-12", strong = false }) {
  const tone = strong ? "skeleton-strong" : "skeleton";
  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn(tone, "h-4", label)} />
      <div className={cn(tone, "w-full rounded-[14px]", box)} />
    </div>
  );
}

/** The button row at the bottom of a wizard step. */
export function WizardButtons({ back = true }: { back?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3 max-sm:flex-col-reverse max-sm:items-stretch">
      {back ? <div className="skeleton h-[52px] w-28 rounded-full" /> : null}
      <div className="ml-auto flex gap-3 max-sm:ml-0 max-sm:flex-col-reverse">
        <div className="skeleton h-[52px] w-52 rounded-full" />
        <div className="skeleton h-[52px] w-60 rounded-full" />
      </div>
    </div>
  );
}
