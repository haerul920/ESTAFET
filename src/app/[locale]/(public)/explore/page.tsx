import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/ui/PageShell";
import { ExploreFilters } from "@/components/features/ExploreFilters";
import { ProjectGrid } from "@/components/features/ProjectGrid";
import { ButtonLink } from "@/components/ui/Button";
import { listTeasers } from "@/lib/db/public";
import { parseAccessFilter, parseFilterYear } from "@/lib/explore";
import { pageAlternates } from "@/lib/seo";
import { after } from "next/server";
import { translationsForList } from "@/lib/translate/server";

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
  const found = await listTeasers({
    q: typeof sp.q === "string" ? sp.q : undefined,
    faculties: list(sp.faculty),
    year: parseFilterYear(sp.year, new Date().getFullYear()),
    access: parseAccessFilter(sp.access),
  });
  const translations = await translationsForList(found, (await getLocale()) === "en" ? "en" : "id", (work) =>
    after(work),
  );
  const projects = found.map((p) => {
    const text = translations.get(p.id);
    return text ? { ...p, title: text.title, summary: text.summary } : p;
  });

  return (
    <PageShell width={1120}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-2 mt-0 text-[40px] font-medium max-sm:text-[32px]">{t("title")}</h1>
          <p className="m-0 text-text-2">{t("lead")}</p>
        </div>
      </div>

      <ExploreFilters resultCount={projects.length}>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-line-strong bg-surface p-10 text-center">
            <PackageSearch size={36} className="text-text-2" aria-hidden="true" />
            <h2 className="m-0 text-xl font-medium">{t("empty.title")}</h2>
            <p className="m-0 max-w-sm text-text-2">{t("empty.text")}</p>
            <ButtonLink href="/explore" variant="outline">
              {t("empty.clear")}
            </ButtonLink>
          </div>
        ) : (
          <>
            {translations.size > 0 ? <p className="mb-3 mt-0 text-sm text-text-2">{t("translatedNote")}</p> : null}
            <ProjectGrid projects={projects} />
          </>
        )}
      </ExploreFilters>
    </PageShell>
  );
}
