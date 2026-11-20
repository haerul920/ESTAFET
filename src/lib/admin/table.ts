/** URL-driven table state: sort, page and filters live in the query string. */
export type SearchParams = Record<string, string | string[] | undefined>;

export interface TableParams {
  sort: string;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
  q: string;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseTableParams(
  sp: SearchParams,
  opts: { sortable: string[]; defaultSort: string; defaultDir?: "asc" | "desc"; pageSize?: number },
): TableParams {
  const sort = opts.sortable.includes(first(sp.sort) ?? "") ? (first(sp.sort) as string) : opts.defaultSort;
  const dirRaw = first(sp.dir);
  const dir = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : (opts.defaultDir ?? "desc");
  const page = Math.max(1, Number.parseInt(first(sp.page) ?? "1", 10) || 1);
  return { sort, dir, page, pageSize: opts.pageSize ?? 15, q: (first(sp.q) ?? "").trim().slice(0, 80) };
}

export function rangeFor(p: TableParams): [number, number] {
  const from = (p.page - 1) * p.pageSize;
  return [from, from + p.pageSize - 1];
}

/** Builds a query string, replacing the given keys and dropping empty values. */
export function withParams(sp: SearchParams, patch: Record<string, string | undefined>): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = first(v);
    if (val) next.set(k, val);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === "") next.delete(k);
    else next.set(k, v);
  }
  const s = next.toString();
  return s ? `?${s}` : "";
}

/** Escapes characters that matter inside a PostgREST ilike pattern. */
export function likePattern(q: string): string {
  return q.replace(/[%,()\\]/g, " ").trim();
}
