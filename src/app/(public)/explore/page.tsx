import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";
import { PageShell } from "@/components/ui/PageShell";
import { DemoBadge } from "@/components/ui/Badge";
import { ExploreFilters } from "@/components/features/ExploreFilters";
import { ProjectGrid } from "@/components/features/ProjectGrid";
import { ButtonLink } from "@/components/ui/Button";
import { listTeasers } from "@/lib/db/public";
import type { ProjectKind, StopReason } from "@/lib/db/types";

export const metadata: Metadata = {
  title: "Explore projects",
  description: "Browse verified, advisor-consented student projects that are ready for a new team to continue.",
};

type Search = Record<string, string | string[] | undefined>;
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const sort = typeof sp.sort === "string" && (sp.sort === "tasks" || sp.sort === "progress") ? sp.sort : "recent";
  const projects = await listTeasers({
    q: typeof sp.q === "string" ? sp.q : undefined,
    kinds: list(sp.kind) as ProjectKind[],
    reasons: list(sp.reason) as StopReason[],
    faculties: list(sp.faculty),
    sort,
  });

  return (
    <PageShell width={1120}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-2 mt-0 text-[40px] font-medium max-sm:text-[32px]">Explore projects</h1>
          <p className="m-0 text-text-2">Each project below was published by its creators and verified before going public.</p>
        </div>
        <DemoBadge>Demo data: sample projects are simulated</DemoBadge>
      </div>

      <ExploreFilters resultCount={projects.length}>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-line-strong bg-surface p-10 text-center">
            <PackageSearch size={36} className="text-text-2" aria-hidden="true" />
            <h2 className="m-0 text-xl font-medium">No projects match these filters</h2>
            <p className="m-0 max-w-sm text-text-2">Try a different keyword or clear a filter. New projects are published all the time.</p>
            <ButtonLink href="/explore" variant="outline">
              Clear filters
            </ButtonLink>
          </div>
        ) : (
          <ProjectGrid projects={projects} />
        )}
      </ExploreFilters>
    </PageShell>
  );
}
