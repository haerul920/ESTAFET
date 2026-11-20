import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumb } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { TeaserContent } from "@/components/features/TeaserContent";
import { getTeaserBySlug, getTeaserItems, getTeaserLineage } from "@/lib/db/public";
import { canReadPrivate, isProjectCreator } from "@/lib/db/access";
import { getCurrentUser } from "@/lib/auth";
import { buildPublicLineage } from "@/lib/lineage";
import { ReportProject } from "@/components/features/ReportProject";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const project = await getTeaserBySlug(slug).catch(() => null);
  if (!project) return { title: "Project not found" };
  return {
    title: project.title,
    description: project.summary,
    openGraph: { title: `${project.title} · ESTAFET`, description: project.summary, type: "article" },
  };
}

export default async function ProjectTeaserPage({ params }: Params) {
  const { slug } = await params;
  const project = await getTeaserBySlug(slug);
  if (!project) notFound();

  const [items, lineageEvents, user] = await Promise.all([
    getTeaserItems(project.id),
    getTeaserLineage(project.id),
    getCurrentUser(),
  ]);
  const [creator, unlocked] = user
    ? await Promise.all([isProjectCreator(project.id), canReadPrivate(project.id)])
    : [false, false];

  const workspace = `/projects/${project.slug}/workspace`;
  const cta = (
    <Card tone="lime" className="flex flex-col gap-3">
      {creator ? (
        <>
          <h2 className="m-0 text-xl">This is your project</h2>
          <p className="m-0 text-[15px] text-text-2">Requests from other teams appear on your dashboard.</p>
          <ButtonLink href="/dashboard" variant="outline">
            Open dashboard
          </ButtonLink>
        </>
      ) : unlocked ? (
        <>
          <h2 className="m-0 text-xl">Your team has access</h2>
          <ButtonLink href={workspace} arrow>
            Open workspace
          </ButtonLink>
        </>
      ) : project.status === "adopted" ? (
        <>
          <h2 className="m-0 text-xl">Already being continued</h2>
          <p className="m-0 text-[15px] text-text-2">Another team has taken over this project. You can still read the teaser.</p>
        </>
      ) : (
        <>
          <h2 className="m-0 text-xl">Want to continue this project?</h2>
          <p className="m-0 text-[15px] text-text-2">Send a short plan. It takes about 5 minutes. Creators reply through ESTAFET.</p>
          <ButtonLink href={`/projects/${project.slug}/request`} className="justify-center">
            Request to continue
          </ButtonLink>
          <p className="m-0 text-[13px] text-text-2">Continuing means crediting the original team in your future submissions.</p>
        </>
      )}
    </Card>
  );
  const ctaWithReport = (
    <div className="flex flex-col gap-4">
      {cta}
      <ReportProject projectId={project.id} />
    </div>
  );

  return (
    <PageShell footerNote={project.is_demo ? "Prototype built for STACK 2026 by team Beban Server. This project is simulated demo data." : undefined}>
      <Breadcrumb items={[{ label: "Explore", href: "/explore" }, { label: project.title }]} />
      <TeaserContent
        project={project}
        items={items}
        lineageSteps={buildPublicLineage(project, lineageEvents)}
        cta={ctaWithReport}
        unlockedHref={unlocked ? workspace : undefined}
      />
    </PageShell>
  );
}
