import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

function Sk({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton", className)} style={style} />;
}

/** PageHeader: 28px title and the short intro. */
function Header() {
  return (
    <div className="mb-5 flex flex-col gap-2">
      <Sk className="h-8 w-56" />
      <Sk className="h-4 w-80 max-w-full" />
    </div>
  );
}

/** FilterBar: search field plus a few chips. */
function Filters() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Sk className="h-11 min-w-[240px] flex-1 rounded-[14px]" />
      <Sk className="h-9 w-28 rounded-full" />
      <Sk className="h-9 w-24 rounded-full" />
    </div>
  );
}

/** StatCard row (label, big number). */
function Stats({ count }: { count: number }) {
  return (
    <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 sk-surface rounded-3xl bg-surface p-5">
          <Sk className="h-3 w-24" />
          <Sk className="h-8 w-14" />
        </div>
      ))}
    </div>
  );
}

/** Panel: mono title, then rows. */
function Panel({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 sk-surface rounded-3xl bg-surface p-5", className)}>
      <Sk className="mb-1 h-3 w-32" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <Sk className="h-4 w-1/2" />
          <Sk className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

/** DataTable: white bordered table with a header row and data rows. */
function Table({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white">
      <div className="flex gap-4 border-b border-line bg-surface px-4 py-3">
        {[30, 18, 14, 14, 12].map((w, i) => (
          <Sk key={i} className="h-3" style={{ width: `${w}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-line-soft px-4 py-3.5 last:border-b-0">
          <Sk className="h-4 w-[30%]" />
          <Sk className="h-4 w-[18%]" />
          <Sk className="h-6 w-[14%] rounded-full" />
          <Sk className="h-4 w-[14%]" />
          <Sk className="h-4 w-[12%]" />
        </div>
      ))}
    </div>
  );
}

export type AdminSkeletonVariant = "overview" | "table" | "detail" | "panels";

/**
 * Loading state of the admin pages, in the admin page layout (the admin shell stays in place):
 * - `overview`: filter toggle, seven stat cards, a grid of panels.
 * - `table`: optional stat cards, the filter bar and a data table (queues and lists).
 * - `detail`: a two-column set of panels (one project, one user).
 * - `panels`: stacked panels (settings, policies, announcements).
 */
export function AdminSkeleton({ variant = "table", stats = 0 }: { variant?: AdminSkeletonVariant; stats?: number }) {
  const t = useTranslations("admin.common");
  return (
    <div role="status" aria-busy="true" aria-label={t("loading")}>
      <div aria-hidden="true">
        <Header />
        {variant === "overview" ? (
          <>
            <Sk className="mb-4 h-9 w-48 rounded-full" />
            <Stats count={7} />
            <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Panel key={i} rows={i % 2 ? 3 : 4} />
              ))}
            </div>
          </>
        ) : null}
        {variant === "table" ? (
          <>
            {stats ? <Stats count={stats} /> : null}
            <Filters />
            <Table />
          </>
        ) : null}
        {variant === "detail" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Panel rows={5} className="md:col-span-2" />
            <Panel rows={4} />
            <Panel rows={4} />
            <Panel rows={3} />
            <Panel rows={3} />
          </div>
        ) : null}
        {variant === "panels" ? (
          <div className="flex flex-col gap-4">
            <Panel rows={3} />
            <Panel rows={4} />
            <Panel rows={3} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
