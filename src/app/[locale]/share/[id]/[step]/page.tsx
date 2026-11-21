import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { hasAcceptedPolicies } from "@/lib/db/access";
import {
  buildChecklist,
  buildSourceViews,
  getOwnedProject,
  getFiles,
  getItems,
  getLatestConsent,
  getLatestRun,
  getTeam,
} from "@/lib/db/owner";
import { getConfig } from "@/lib/llm";
import { StepHeader, WIZARD_STEPS, WizardFrame, type WizardStep } from "@/components/features/wizard/WizardFrame";
import { BasicsForm } from "@/components/features/wizard/BasicsForm";
import { ConsentStep } from "@/components/features/wizard/ConsentStep";
import { FilesStep } from "@/components/features/wizard/FilesStep";
import { VerifyBoard } from "@/components/features/wizard/VerifyBoard";
import { PublishBar } from "@/components/features/wizard/PublishBar";
import { PublishChecklist } from "@/components/features/wizard/PublishChecklist";
import { TeaserContent } from "@/components/features/TeaserContent";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { DraftItem, ProjectFile, TeaserItem, TeaserProject } from "@/lib/db/types";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "wizard" });
  return { title: tm("shareMeta") };
}

type Params = { params: Promise<{ id: string; step: string }> };

function sourceLabel(item: DraftItem, files: ProjectFile[]): string | null {
  const ev = item.evidence[0];
  if (!ev) return null;
  const f = files.find((x) => x.id === ev.file_id);
  if (!f) return null;
  return `${f.original_name}${f.kind === "markdown" ? ", section " : ", p."}${ev.page}`;
}

export default async function WizardStepPage({ params }: Params) {
  const { id, step } = await params;
  if (!(WIZARD_STEPS as readonly string[]).includes(step)) notFound();
  const current = step as WizardStep;
  const user = await requireUser(`/share/${id}/${step}`);
  const [locale, t, tl] = await Promise.all([getLocale(), getTranslations("wizard"), getTranslations("lineage")]);
  void locale;
  const project = await getOwnedProject(id);
  if (!project) notFound();

  const [team, consent, files, items, run, policiesAccepted] = await Promise.all([
    getTeam(id),
    getLatestConsent(id),
    getFiles(id),
    getItems(id),
    getLatestRun(id),
    hasAcceptedPolicies(),
  ]);
  const checklist = buildChecklist(team, consent, items, {
    advisorMode: project.advisor_mode,
    noAdvisorDeclared: project.no_advisor_declared_at !== null,
    policiesAccepted,
  });
  const config = getConfig();

  if (current === "basics") {
    return (
      <WizardFrame projectId={id} current="basics">
        <StepHeader title={t("basicsTitle")} intro={t("editIntro")} />
        <BasicsForm project={project} />
      </WizardFrame>
    );
  }

  if (current === "consent") {
    return (
      <WizardFrame projectId={id} current="consent">
        <StepHeader
          title={t("consentTitle")}
          intro={t("consentIntro")}
        />
        <div className="flex flex-wrap items-start gap-8">
          <div className="min-w-0 flex-[1_1_600px]">
            <ConsentStep project={project} team={team} currentUserId={user.id} consent={consent} />
          </div>
          <div className="flex min-w-[260px] flex-[0_1_340px] flex-col gap-4">
            <PublishChecklist projectId={id} checklist={checklist} advisorEmail={project.advisor_email} step="consent" />
            <Card tone="blue">
              <h2 className="mb-2 mt-0 text-base">{t("advisorSees")}</h2>
              <p className="m-0 text-[15px] text-text-3">{t("advisorSeesText")}</p>
            </Card>
          </div>
        </div>
      </WizardFrame>
    );
  }

  if (current === "files") {
    const readable = files.filter((f) => f.extracted_text_path).length;
    const blockReason = t("filesBlock");
    return (
      <WizardFrame projectId={id} current="files">
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-6">
            <StepHeader
              title={t("filesTitle")}
              intro={t("filesIntro")}
            />
            <FilesStep
              projectId={id}
              files={files}
              itemCount={items.length}
              canSynthesize={checklist.team.done && readable > 0}
              blockReason={blockReason}
              mockMode={config.mode === "mock"}
            />
          </div>
          <div className="mt-[88px] flex min-w-[260px] flex-[0_1_340px] flex-col gap-4 max-lg:mt-0">
            <PublishChecklist projectId={id} checklist={checklist} advisorEmail={project.advisor_email} step="files" />
            <Card tone="blue">
              <h2 className="mb-2 mt-0 text-base">{t("publicTitle")}</h2>
              <p className="m-0 text-[15px] text-text-3">{t("publicText")}</p>
            </Card>
          </div>
        </div>
      </WizardFrame>
    );
  }

  if (current === "verify") {
    const sources = await buildSourceViews(items, files);
    return (
      <WizardFrame projectId={id} current="verify">
        {items.length === 0 && run?.status === "failed" ? (
          <Card tone="warn" className="mb-6">
            <strong>{t("lastFailed")}</strong> {run.error}
          </Card>
        ) : null}
        <VerifyBoard
          projectId={id}
          initialItems={items}
          sources={sources}
          checklist={checklist}
          mockMode={(run?.mode ?? config.mode) === "mock"}
          summary={project.summary}
          draftSummary={run?.summary_draft ?? null}
        />
      </WizardFrame>
    );
  }

  // Publish step: preview exactly like the public page
  const published = project.status === "published";
  const kept = items.filter((i) => i.review_status === "kept");
  const teaserItems: TeaserItem[] = kept.map((i) => ({
    id: i.id,
    project_id: i.project_id,
    kind: i.kind,
    title: i.title,
    description: i.description,
    effort: i.effort,
    lesson_type: i.lesson_type,
    objective_status: i.objective_status,
    position: i.position,
    source_label: sourceLabel(i, files),
  }));
  const objectives = kept.filter((i) => i.kind === "objective");
  const teaser: TeaserProject = {
    id: project.id,
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    kind: project.kind,
    field: project.field,
    year: project.year,
    stop_reason: project.stop_reason,
    status: project.status,
    advisor_name: project.advisor_name,
    is_demo: project.is_demo,
    published_at: project.published_at,
    stopped_note: project.stopped_note,
    tech: project.tech,
    team_size: Math.max(project.team_size, team.length),
    objectives_total: objectives.length,
    objectives_done: objectives.filter((o) => o.objective_status === "done").length,
    tasks_count: kept.filter((i) => i.kind === "next_task").length,
    access_mode: project.access_mode,
    max_active_adopters: project.max_active_adopters,
    active_adopters: 0,
    no_advisor: project.advisor_mode === "none",
  };
  const reason = !checklist.team.done
    ? t("reasonTeam")
    : !checklist.advisor.done
      ? t("reasonAdvisor")
      : !checklist.review.done
        ? t("reasonReview")
        : "";

  return (
    <WizardFrame projectId={id} current="publish">
      <StepHeader
        title={published ? t("liveTitle") : t("previewTitle")}
        intro={published ? t("liveIntro") : t("previewIntro")}
      />
      {published ? (
        <Card tone="blue" className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-ok" aria-hidden="true" /> <strong>{t("publishedBold")}</strong> {t("publishedText")}
          </span>
          <ButtonLink href={`/projects/${project.slug}`} arrow>
            {t("viewPublic")}
          </ButtonLink>
        </Card>
      ) : null}
      <div className="rounded-[36px] border border-dashed border-line-strong p-6 max-sm:p-3">
        <div className="mb-6 flex items-center gap-2">
          <Badge tone="info">{t("preview")}</Badge>
          <span className="text-sm text-text-2">{t("previewNote")}</span>
        </div>
        <TeaserContent
          project={teaser}
          items={teaserItems}
          lineageSteps={[
            { id: "o", title: tl("origin"), sub: tl("originSub", { year: project.year }), state: "done" },
            { id: "p", title: tl("published"), sub: published ? tl("live") : tl("afterPublish"), state: published ? "done" : "next" },
            { id: "n", title: tl("next"), sub: tl("nextWaiting"), state: "next" },
          ]}
          cta={
            <Card tone="lime" className="flex flex-col gap-2">
              <h2 className="m-0 text-xl">{t("ctaTitle")}</h2>
              <p className="m-0 text-[15px] text-text-2">
                {project.access_mode === "open" ? t("ctaOpen") : project.access_mode === "paused" ? t("ctaPaused") : t("ctaRequest")}
              </p>
            </Card>
          }
        />
      </div>
      {published ? null : (
        <PublishBar
          projectId={id}
          ready={checklist.team.done && checklist.advisor.done && checklist.review.done}
          reason={reason}
          policiesAccepted={policiesAccepted}
          verified={user.verified}
        />
      )}
    </WizardFrame>
  );
}
