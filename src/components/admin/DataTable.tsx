import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { withParams, type SearchParams, type TableParams } from "@/lib/admin/table";
import { EmptyState } from "./ui";

export interface Column<Row> {
  key: string;
  label: string;
  /** Sort key sent to the database (defaults to `key` when sortable). */
  sortable?: boolean;
  render?: (row: Row) => React.ReactNode;
  className?: string;
}

/**
 * Server-driven table: sorting, filtering and paging all come from URL params, so the state is
 * shareable and works without client JS. Rows are links (keyboard accessible); below 768 px each
 * row becomes a card.
 */
export function DataTable<Row extends { id: string }>({
  columns,
  rows,
  total,
  params,
  sp,
  basePath,
  rowHref,
  caption,
  empty,
  selectedId,
}: {
  columns: Column<Row>[];
  rows: Row[];
  total: number;
  params: TableParams;
  sp: SearchParams;
  basePath: string;
  /** Where Enter or a click on the first cell goes. */
  rowHref?: (row: Row) => string;
  caption: string;
  empty?: { title: string; text?: string };
  selectedId?: string | null;
}) {
  if (rows.length === 0) {
    return <EmptyState title={empty?.title ?? "Nothing here"} text={empty?.text ?? "Try clearing a filter."} />;
  }
  const pages = Math.max(1, Math.ceil(total / params.pageSize));
  const sortHref = (key: string) =>
    basePath + withParams(sp, { sort: key, dir: params.sort === key && params.dir === "desc" ? "asc" : "desc", page: undefined });
  const cell = (c: Column<Row>, r: Row) => (c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "—"));

  return (
    <div>
      <div className="hidden overflow-x-auto rounded-3xl border border-line bg-white md:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = params.sort === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (params.dir === "asc" ? "ascending" : "descending") : undefined}
                    className="sticky top-0 border-b border-line bg-surface px-4 py-3 font-semibold first:rounded-tl-3xl last:rounded-tr-3xl"
                  >
                    {c.sortable ? (
                      <Link href={sortHref(c.key)} className="inline-flex items-center gap-1 text-ink no-underline hover:underline">
                        {c.label}
                        {active ? params.dir === "asc" ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" /> : null}
                      </Link>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cn("border-b border-line-soft last:border-b-0 hover:bg-surface/60", selectedId === r.id && "bg-blue-tint/60")}>
                {columns.map((c, i) => (
                  <td key={c.key} className={cn("px-4 py-3 align-top", c.className)}>
                    {i === 0 && rowHref ? (
                      <Link href={rowHref(r)} className="font-semibold text-ink no-underline hover:underline focus-visible:underline">
                        {cell(c, r)}
                      </Link>
                    ) : (
                      cell(c, r)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden" aria-label={caption}>
        {rows.map((r) => (
          <li key={r.id} className="rounded-3xl border border-line bg-white p-4">
            {columns.map((c, i) => (
              <div key={c.key} className={cn("flex items-start justify-between gap-3 py-1 text-sm", i === 0 && "pb-2 text-base")}>
                {i === 0 ? null : <span className="text-text-2">{c.label}</span>}
                <span className={cn("min-w-0 text-right", i === 0 && "text-left font-semibold")}>
                  {i === 0 && rowHref ? (
                    <Link href={rowHref(r)} className="text-ink no-underline">
                      {cell(c, r)}
                    </Link>
                  ) : (
                    cell(c, r)
                  )}
                </span>
              </div>
            ))}
          </li>
        ))}
      </ul>

      <nav aria-label="Pagination" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-text-2">
        <span>
          {total} {total === 1 ? "row" : "rows"} · page {params.page} of {pages}
        </span>
        <span className="flex gap-2">
          <PageLink disabled={params.page <= 1} href={basePath + withParams(sp, { page: String(params.page - 1) })} label="Previous page">
            <ChevronLeft size={16} aria-hidden="true" /> Previous
          </PageLink>
          <PageLink disabled={params.page >= pages} href={basePath + withParams(sp, { page: String(params.page + 1) })} label="Next page">
            Next <ChevronRight size={16} aria-hidden="true" />
          </PageLink>
        </span>
      </nav>
    </div>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "inline-flex min-h-[36px] items-center gap-1 rounded-full border border-line-strong bg-white px-3.5 font-semibold text-ink no-underline";
  return disabled ? (
    <span aria-disabled="true" aria-label={label} className={cn(cls, "opacity-40")}>
      {children}
    </span>
  ) : (
    <Link href={href} aria-label={label} className={cn(cls, "hover:bg-surface")}>
      {children}
    </Link>
  );
}
