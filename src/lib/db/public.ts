import "server-only";
import type { AccessFilter } from "@/lib/explore";
import { createClient } from "@/lib/supabase/server";
import type { TeaserItem, TeaserLineageEvent, TeaserProject } from "./types";

export interface ExploreFilters {
  q?: string;
  /**
   * Extra search matches for `q` that the view cannot see itself: projects whose cached translation matches (the
   * reader may search in the other language), and stored faculty names whose translated label matches ("Teknik").
   */
  qMatches?: { projectIds?: string[]; fields?: string[] };
  faculties?: string[];
  year?: number;
  access?: AccessFilter;
}

/** Published teasers only, via the public_project_teaser view. */
export async function listTeasers(filters: ExploreFilters = {}): Promise<TeaserProject[]> {
  const supabase = await createClient();
  let query = supabase.from("public_project_teaser").select("*");

  const q = filters.q?.trim().replace(/[%,()]/g, " ");
  if (q) {
    const ors = [`title.ilike.%${q}%`, `summary.ilike.%${q}%`, `field.ilike.%${q}%`];
    const ids = (filters.qMatches?.projectIds ?? []).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    if (ids.length) ors.push(`id.in.(${ids.join(",")})`);
    for (const field of filters.qMatches?.fields ?? []) ors.push(`field.eq."${field.replace(/"/g, "")}"`);
    query = query.or(ors.join(","));
  }
  if (filters.faculties?.length) query = query.in("field", filters.faculties);
  if (filters.year) query = query.eq("year", filters.year);
  if (filters.access) query = query.eq("access_mode", filters.access);

  // Always newest first. Without nullsFirst: false, rows with no date would come out on top.
  const { data, error } = await query.order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Could not load projects: ${error.message}`);
  return (data ?? []) as TeaserProject[];
}

export async function getTeaserBySlug(slug: string): Promise<TeaserProject | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("public_project_teaser").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Could not load the project: ${error.message}`);
  return (data as TeaserProject | null) ?? null;
}

export async function getTeaserItems(projectId: string): Promise<TeaserItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_teaser_items")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw new Error(`Could not load project items: ${error.message}`);
  return (data ?? []) as TeaserItem[];
}

/** How many project ids go into one request. A longer list makes an address too long to send. */
export const ID_BATCH = 40;

export function inBatches<T>(list: T[], size = ID_BATCH): T[][] {
  return Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
}

/** The public items of many projects, grouped by project. A few requests however long the list is. */
export async function getTeaserItemsFor(projectIds: string[]): Promise<Map<string, TeaserItem[]>> {
  const supabase = await createClient();
  const answers = await Promise.all(
    inBatches(projectIds).map((ids) =>
      supabase.from("public_teaser_items").select("*").in("project_id", ids).order("position", { ascending: true }),
    ),
  );
  const grouped = new Map<string, TeaserItem[]>();
  for (const { data, error } of answers) {
    if (error) throw new Error(`Could not load project items: ${error.message}`);
    for (const item of (data ?? []) as TeaserItem[]) {
      const list = grouped.get(item.project_id);
      if (list) list.push(item);
      else grouped.set(item.project_id, [item]);
    }
  }
  return grouped;
}

export async function getTeaserLineage(projectId: string): Promise<TeaserLineageEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_project_lineage")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load lineage: ${error.message}`);
  return (data ?? []) as TeaserLineageEvent[];
}
