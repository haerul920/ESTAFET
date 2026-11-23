import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * Skeleton building blocks for `loading.tsx`. Each one has the size of the real component it stands for
 * (Card, Field, Button, headings), so the page does not jump when the real content arrives.
 * Everything here is decorative; wrap a page's skeleton in <SkStatus> once for screen readers.
 */

/** One grey block with the shimmer. */
export function Sk({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton", className)} style={style} />;
}

/** The single live region of a skeleton page: announces "loading" and hides the shapes from screen readers. */
export function SkStatus({ children, className }: { children: React.ReactNode; className?: string }) {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{t("loadingPage")}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

const TITLE = {
  /** text-[44px] (project title) */
  xl: "h-12 max-sm:h-9",
  /** text-[40px] (dashboard, first-run) */
  lg: "h-11 max-sm:h-8",
  /** text-4xl / text-[36px] (most pages) */
  md: "h-10 max-sm:h-8",
  /** text-[30px] */
  sm: "h-9",
} as const;

/** An h1 and its lead paragraph, with the same margins as the pages. */
export function SkPageHeader({
  size = "md",
  titleWidth = "w-80",
  lead = [100, 55],
  className,
}: {
  size?: keyof typeof TITLE;
  titleWidth?: string;
  /** Widths (%) of the lead lines. An empty array leaves the lead out. */
  lead?: number[];
  className?: string;
}) {
  return (
    <div className={cn("mb-8", className)}>
      <Sk className={cn(TITLE[size], titleWidth, "mb-3 max-w-full")} />
      {lead.length ? (
        <div className="flex max-w-[640px] flex-col gap-2">
          {lead.map((w, i) => (
            <Sk key={i} className="h-4" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Lines of body text. */
export function SkLines({
  widths = [100, 92, 60],
  className,
  line = "h-4",
}: {
  widths?: number[];
  className?: string;
  line?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {widths.map((w, i) => (
        <Sk key={i} className={line} style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

/** A labelled input (Field: label, then a 48px input). `tall` stands for a textarea. */
export function SkField({
  label = "w-32",
  tall = false,
  hint,
  className,
}: {
  label?: string;
  tall?: boolean;
  /** Width of the hint line under the input, when the real field has one. */
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Sk className={cn("h-4", label)} />
      <Sk className={cn("w-full rounded-[14px]", tall ? "h-28" : "h-12")} />
      {hint ? <Sk className={cn("h-3", hint)} /> : null}
    </div>
  );
}

/** A checkbox with its label. */
export function SkCheck({ widths = [80] }: { widths?: number[] }) {
  return (
    <div className="flex min-h-[44px] items-start gap-3">
      <Sk className="mt-0.5 h-5 w-5 flex-none rounded" />
      <SkLines widths={widths} className="flex-1 pt-0.5" />
    </div>
  );
}

/** A pill button (44px, or 52px for `lg`). */
export function SkButton({
  width = "w-40",
  size = "md",
  className,
}: {
  width?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  return <Sk className={cn("rounded-full", size === "lg" ? "h-[52px]" : "h-11", width, className)} />;
}

/** A small badge or chip. */
export function SkChip({ width = "w-28" }: { width?: string }) {
  return <Sk className={cn("h-7 rounded-full", width)} />;
}

/** A card frame with the Card padding and radius. The children are its inner shapes. */
export function SkCard({
  children,
  tone = "surface",
  className,
}: {
  children?: React.ReactNode;
  tone?: "surface" | "white" | "dashed";
  className?: string;
}) {
  const toneCls =
    tone === "white"
      ? "border border-line-soft bg-white"
      : tone === "dashed"
        ? "sk-surface border border-dashed border-line-strong bg-chip"
        : "sk-surface border border-surface bg-surface";
  return <div className={cn("rounded-[28px] p-6", toneCls, className)}>{children}</div>;
}

/** A card with a heading and a few lines: the most common section on inner pages. */
export function SkSectionCard({
  heading = "w-48",
  lines = [100, 85],
  children,
  className,
}: {
  heading?: string;
  lines?: number[];
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <SkCard className={cn("flex flex-col gap-3", className)}>
      <Sk className={cn("h-6", heading)} />
      {lines.length ? <SkLines widths={lines} /> : null}
      {children}
    </SkCard>
  );
}

/** The breadcrumb line above a page title. */
export function SkBreadcrumb({ width = "w-64" }: { width?: string }) {
  return <Sk className={cn("mb-4 h-4 max-w-full", width)} />;
}

/** The wizard stepper: five steps, each a thin bar and a label. */
export function SkStepper({ steps = 5 }: { steps?: number }) {
  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {Array.from({ length: steps }, (_, i) => (
        <div key={i} className="flex min-w-[130px] flex-1 flex-col gap-2">
          <Sk className="h-1.5 rounded-full" />
          <Sk className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
