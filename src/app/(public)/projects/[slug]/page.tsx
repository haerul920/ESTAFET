import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell, Breadcrumb } from "@/components/ui/PageShell";
import { TeaserContent } from "@/components/features/TeaserContent";
import { ProjectCta, type CtaState } from "@/components/features/ProjectCta";
import { getTeaserBySlug, getTeaserItems, getTeaserLineage } from "@/lib/db/public";
import { getMyAccess, isProjectOwner } from "@/lib/db/access";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildPublicLineage } from "@/lib/lineage";
import { ReportProject } from "@/components/features/ReportProject";
import type { TeaserProject } from "@/lib/db/types";

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

const quotaIsFull = (p: Pick<TeaserProject, "max_active_adopters" | "active_adopters">) =>
  p.max_active_adopters !== null && p.active_adopters >= p.max_active_adopters;

/** Decides what the visitor can do from their relationship to this project. No account type is involved. */
async function ctaStateFor(project: TeaserProject): Promise<CtaState> {
  const user = await getCurrentUser();
  const full = quotaIsFull(project);
  if (!user) return { kind: "guest", mode: project.access_mode, quotaFull: full };
  if (await isProjectOwner(project.id)) return { kind: "owner" };

  const access = await getMyAccess(project.id, user.id);
  if (access?.status === "active") return { kind: "holder" };
  if (access?.status === "revoked") return { kind: "revoked" };

  const supabase = await createClient();
  const { data: open } = await supabase
    .from("continuation_requests")
    .select("id, status")
    .eq("project_id", project.id)
    .eq("created_by", user.id)
    .in("status", ["pending", "approved"])
    .maybeSingle();
  if (open) return { kind: "request", requestId: open.id as string, status: open.status as "pending" | "approved" };

  if (project.access_mode === "paused") return { kind: "paused" };
  if (full) return { kind: "quota_full" };
  return project.access_mode === "open"
    ? { kind: "open", verified: user.verified, email: user.email }
    : { kind: "by_request", verified: user.verified, email: user.email };
}

export default async function ProjectTeaserPage({ params }: Params) {
  const { slug } = await params;
  const project = await getTeaserBySlug(slug);
  if (!project) notFound();

  const [items, lineageEvents, state] = await Promise.all([getTeaserItems(project.id), getTeaserLineage(project.id), ctaStateFor(project)]);
  const unlocked = state.kind === "owner" || state.kind === "holder";
  const workspace = `/projects/${project.slug}/workspace`;

  const cta = (
    <div className="flex flex-col gap-4">
      <ProjectCta state={state} projectId={project.id} slug={project.slug} />
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
        cta={cta}
        unlockedHref={unlocked ? workspace : undefined}
      />
    </PageShell>
  );
}
