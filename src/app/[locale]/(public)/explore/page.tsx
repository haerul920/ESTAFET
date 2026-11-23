import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/ui/PageShell";
import { DemoBadge } from "@/components/ui/Badge";
import { ExploreFilters } from "@/components/features/ExploreFilters";
import { ProjectGrid } from "@/components/features/ProjectGrid";
import { ButtonLink } from "@/components/ui/Button";
import { listTeasers } from "@/lib/db/public";
import { pageAlternates } from "@/lib/seo";
import type { ProjectKind, StopReason } from "@/lib/db/types";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "explore.meta" });
  return { title: t("title"), description: t("description"), alternates: pageAlternates(locale, "/explore") };
}

type Search = Record<string, string | string[] | undefined>;
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const t = await getTranslations("explore");
  const sort = typeof sp.sort === "string" && (sp.sort === "tasks" || sp.sort === "progress") ? sp.sort : "recent";
  const filters = {
    q: typeof sp.q === "string" && sp.q.trim() ? sp.q : undefined,
    kinds: list(sp.kind) as ProjectKind[],
    reasons: list(sp.reason) as StopReason[],
    faculties: list(sp.faculty),
  };
  const filtered = Boolean(filters.q) || filters.kinds.length + filters.reasons.length + filters.faculties.length > 0;
  const projects = await listTeasers({ ...filters, sort });
  // The "Data contoh" badge only when demo projects are actually on the page (never on an empty or real list).
  const showsDemo = projects.some((p) => p.is_demo);

  return (
    <PageShell width={1120}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-2 mt-0 text-[40px] font-medium max-sm:text-[32px]">{t("title")}</h1>
          <p className="m-0 text-text-2">{t("lead")}</p>
        </div>
        {showsDemo ? <DemoBadge>{t("demo")}</DemoBadge> : null}
      </div>

      <ExploreFilters resultCount={projects.length}>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-line-strong bg-surface p-10 text-center">
            <PackageSearch size={36} className="text-text-2" aria-hidden="true" />
            {filtered ? (
              <>
                <h2 className="m-0 text-xl font-medium">{t("empty.title")}</h2>
                <p className="m-0 max-w-sm text-text-2">{t("empty.text")}</p>
                <ButtonLink href="/explore" variant="outline">
                  {t("empty.clear")}
                </ButtonLink>
              </>
            ) : (
              <>
                <h2 className="m-0 text-xl font-medium">{t("none.title")}</h2>
                <p className="m-0 max-w-sm text-text-2">{t("none.text")}</p>
                <ButtonLink href="/bagikan" variant="outline">
                  {t("none.cta")}
                </ButtonLink>
              </>
            )}
          </div>
        ) : (
          <ProjectGrid projects={projects} />
        )}
      </ExploreFilters>
    </PageShell>
  );
}
