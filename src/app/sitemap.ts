import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { routing } from "@/i18n/routing";
import { localizedUrl } from "@/lib/seo";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/supabase/keys";

/**
 * The public pages in both languages, with each page pointing at its other-language twin. Projects come from the
 * public teaser view, which only has published, unmoderated projects, so a held or hidden project is never listed.
 * The legal pages are drafts marked noindex, so they are not listed either.
 */
export const dynamic = "force-dynamic";

function entry(path: string, lastModified?: string, priority = 0.6): MetadataRoute.Sitemap[number] {
  return {
    url: localizedUrl(routing.defaultLocale, path),
    lastModified,
    priority,
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, localizedUrl(l, path)])) },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = [entry("/", undefined, 1), entry("/explore", undefined, 0.9)];
  let projects: MetadataRoute.Sitemap = [];
  try {
    const db = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, { auth: { persistSession: false } });
    const { data } = await db
      .from("public_project_teaser")
      .select("slug, published_at, is_demo")
      .eq("is_demo", false)
      .order("published_at", { ascending: false })
      .limit(5000);
    projects = (data ?? []).map((p) =>
      entry(`/projects/${encodeURIComponent(p.slug as string)}`, (p.published_at as string) ?? undefined),
    );
  } catch {
    // The static pages are still listed when the database is unreachable.
  }
  return [...pages, ...projects];
}
