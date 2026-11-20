import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProjectKind, StopReason, TeaserItem, TeaserLineageEvent, TeaserProject } from "./types";

export interface ExploreFilters {
  q?: string;
  kinds?: ProjectKind[];
  reasons?: StopReason[];
  faculties?: string[];
  sort?: "recent" | "tasks" | "progress";
}

/** Published teasers only, via the public_project_teaser view. */
export async function listTeasers(filters: ExploreFilters = {}): Promise<TeaserProject[]> {
  const supabase = await createClient();
  let query = supabase.from("public_project_teaser").select("*");

  const q = filters.q?.trim().replace(/[%,()]/g, " ");
  if (q) query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%,field.ilike.%${q}%`);
  if (filters.kinds?.length) query = query.in("kind", filters.kinds);
  if (filters.reasons?.length) query = query.in("stop_reason", filters.reasons);
  if (filters.faculties?.length) query = query.in("field", filters.faculties);

  const { data, error } = await query.order("published_at", { ascending: false });
  if (error) throw new Error(`Could not load projects: ${error.message}`);
  let rows = (data ?? []) as TeaserProject[];

  if (filters.sort === "tasks") rows = [...rows].sort((a, b) => b.tasks_count - a.tasks_count);
  if (filters.sort === "progress") {
    const pct = (p: TeaserProject) => (p.objectives_total ? p.objectives_done / p.objectives_total : 0);
    rows = [...rows].sort((a, b) => pct(b) - pct(a));
  }
  return rows;
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

export function progressPct(p: Pick<TeaserProject, "objectives_done" | "objectives_total">): number {
  return p.objectives_total ? Math.round((p.objectives_done / p.objectives_total) * 100) : 0;
}
