import "server-only";
import { createClient } from "@/lib/supabase/server";
import { likePattern, parseTableParams, rangeFor, type SearchParams, type TableParams } from "./table";

export interface QueryConfig {
  sortable: string[];
  defaultSort: string;
  defaultDir?: "asc" | "desc";
  /** Columns searched with ilike for the `q` param. */
  searchCols?: string[];
  /** URL param -> column, matched with eq. */
  eq?: Record<string, string>;
  /** Demo rows are left out of admin lists (CLAUDE.md 15.29). Names the boolean column. */
  demoCol?: string;
  /** Extra filter, for example date ranges. */
  // The Postgrest builder type is deeply generic; callers only chain filter methods on it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply?: (q: any, sp: SearchParams) => any;
  pageSize?: number;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads one of the admin_* views with URL-driven filters, sort and paging. The view itself enforces is_admin(). */
export async function queryView<Row>(
  view: string,
  sp: SearchParams,
  cfg: QueryConfig,
): Promise<{ rows: Row[]; total: number; params: TableParams }> {
  const params = parseTableParams(sp, {
    sortable: cfg.sortable,
    defaultSort: cfg.defaultSort,
    defaultDir: cfg.defaultDir,
    pageSize: cfg.pageSize,
  });
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from(view).select("*", { count: "exact" });
  if (params.q && cfg.searchCols?.length) {
    const p = likePattern(params.q);
    if (p) q = q.or(cfg.searchCols.map((c) => `${c}.ilike.%${p}%`).join(","));
  }
  for (const [param, col] of Object.entries(cfg.eq ?? {})) {
    const v = first(sp[param]);
    if (v) q = q.eq(col, v);
  }
  if (cfg.demoCol) q = q.eq(cfg.demoCol, false);
  if (cfg.apply) q = cfg.apply(q, sp);
  const [from, to] = rangeFor(params);
  const { data, count, error } = await q.order(params.sort, { ascending: params.dir === "asc" }).range(from, to);
  if (error) throw new Error(`Could not load ${view}: ${error.message}`);
  return { rows: (data ?? []) as Row[], total: count ?? 0, params };
}
