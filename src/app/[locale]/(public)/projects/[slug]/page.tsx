import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageShell, Breadcrumb } from "@/components/ui/PageShell";
import { ButtonLink } from "@/components/ui/Button";
import { HeldNotice } from "@/components/features/HeldNotice";
import { TeaserContent } from "@/components/features/TeaserContent";
import { ProjectCta, type CtaState } from "@/components/features/ProjectCta";
import { getTeaserBySlug, getTeaserItems, getTeaserLineage } from "@/lib/db/public";
import { getMyAccess, isProjectOwner } from "@/lib/db/access";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildPublicLineage } from "@/lib/lineage";
import { ReportDialog } from "@/components/features/ReportDialog";
import type { TFn } from "@/lib/labels";
import type { TeaserProject } from "@/lib/db/types";
import { jsonLd, pageAlternates, projectJsonLd } from "@/lib/seo";
import { getLabels } from "@/lib/get-labels";
import { ArrowLeft } from "lucide-react";
import { translationFor } from "@/lib/translate/server";
import { withTranslation } from "@/lib/translate/core";
import { TranslationNote } from "@/components/features/TranslationNote";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const tm = await getTranslations({ locale, namespace: "teaser" });
  const project = await getTeaserBySlug(slug).catch(() => null);
  // A project that is not public (held, hidden, unpublished, missing) is never indexed.
  if (!project) return { title: tm("notFoundTitle"), robots: { index: false, follow: false } };
  return {
    title: project.title,
    description: project.summary,
    alternates: pageAlternates(locale, `/projects/${project.slug}`),
    openGraph: { title: `${project.title} · ESTAFET`, description: project.summary, type: "article" },
  };
}

const quotaIsFull = (p: Pick<TeaserProject, "max_active_adopters" | "active_adopters">) =>
  p.max_active_adopters !== null && p.active_adopters >= p.max_active_adopters;

/** Decides what the visitor can do from their relationship to this project. No account type is involved. */
async function ctaStateFor(project: TeaserProject, asVisitor: boolean): Promise<CtaState> {
  // "Preview as a visitor" (owners only, from the settings page): show exactly what a signed-out person sees.
  const user = asVisitor ? null : await getCurrentUser();
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

  const watching = full
    ? !!(
        await supabase
          .from("project_watchers")
          .select("project_id")
          .eq("project_id", project.id)
          .eq("profile_id", user.id)
          .maybeSingle()
      ).data
    : false;
  if (full) return { kind: "quota_full", watching };
  return project.access_mode === "open"
    ? { kind: "open", verified: user.verified, email: user.email }
    : { kind: "by_request", verified: user.verified, email: user.email };
}

export default async function ProjectTeaserPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<{ as?: string; original?: string }> }) {
  const { slug } = await params;
  const { as, original } = await searchParams;
  const project = await getTeaserBySlug(slug);
  if (!project) {
    // A project that is being held (after reports or by an admin) is not shown, but visitors get a neutral notice
    // instead of a confusing "not found". No reason and no title are revealed.
    const supabase = await createClient();
    const { data: held } = await supabase.rpc("is_project_held", { p_slug: slug });
    if (held === true) return <HeldNotice />;
    notFound();
  }
  const [locale, t, tl] = await Promise.all([getLocale(), getTranslations("teaser"), getTranslations("lineage")]);

  // Only an owner can ask for the visitor preview. For everyone else the parameter is ignored.
  const asVisitor = as === "visitor" && (await isProjectOwner(project.id));
  const [items, lineageEvents, state] = await Promise.all([
    getTeaserItems(project.id),
    getTeaserLineage(project.id),
    ctaStateFor(project, asVisitor),
  ]);
  const signedIn = (await getCurrentUser()) !== null;
  const labels = await getLabels();
  // The owners wrote in their own language. A reader of the other one gets a labelled machine translation.
  const translation = await translationFor(project, items, locale === "en" ? "en" : "id");
  const shown =
    translation && original !== "1" ? withTranslation(project, items, translation) : { project, items: items };
  const unlocked = state.kind === "owner" || state.kind === "holder";
  const workspace = `/projects/${project.slug}/workspace`;

  const cta = <ProjectCta state={state} projectId={project.id} slug={project.slug} />;

  return (
    <PageShell width={920}>
      {/* Structured data for search engines. A data block is not executed, so the script policy does not apply to it. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(projectJsonLd(project, locale)) }} />
      {asVisitor ? (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-blue-tint p-4 text-blue-dark"
        >
          <span>{t("previewBanner")}</span>
          <ButtonLink href={`/proyek/${project.slug}/pengaturan`} variant="outlineBlue" size="md">
            {t("previewExit")}
          </ButtonLink>
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: t("explore"), href: "/explore" }, { label: project.title }]} />
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/explore" variant="outline" className="h-11 px-4 py-0 text-sm">
            <ArrowLeft size={16} aria-hidden="true" /> {t("back")}
          </ButtonLink>
          <ReportDialog projectId={project.id} signedIn={signedIn} />
        </div>
      </div>
      {translation ? <TranslationNote slug={slug} original={original === "1"} /> : null}
      <TeaserContent
        project={shown.project}
        items={shown.items}
        lineageSteps={buildPublicLineage(
          { year: project.year, faculty: labels.faculty(project.field) },
          lineageEvents,
          tl as unknown as TFn,
          locale,
        )}
        cta={cta}
        unlockedHref={unlocked ? workspace : undefined}
      />
    </PageShell>
  );
}
