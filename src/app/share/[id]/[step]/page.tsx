import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  buildChecklist,
  buildSourceViews,
  getCreatorProject,
  getFiles,
  getItems,
  getLatestConsent,
  getLatestRun,
  getTeam,
} from "@/lib/db/creator";
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

export const metadata: Metadata = { title: "Share a project" };

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
  const project = await getCreatorProject(id);
  if (!project) notFound();

  const [team, consent, files, items, run] = await Promise.all([
    getTeam(id),
    getLatestConsent(id),
    getFiles(id),
    getItems(id),
    getLatestRun(id),
  ]);
  const checklist = buildChecklist(team, consent, items);
  const config = getConfig();

  if (current === "basics") {
    return (
      <WizardFrame projectId={id} current="basics">
        <StepHeader title="Tell us about your project" intro="Change anything here. Saving moves you on to the consent step." />
        <BasicsForm project={project} />
      </WizardFrame>
    );
  }

  if (current === "consent") {
    return (
      <WizardFrame projectId={id} current="consent">
        <StepHeader
          title="Get consent before anything is read"
          intro="Your teammates confirm they are happy to share the project, and your advisor approves through a private link. ESTAFET reads your files only after both."
        />
        <div className="flex flex-wrap items-start gap-8">
          <div className="min-w-0 flex-[1_1_600px]">
            <ConsentStep project={project} team={team} currentUserId={user.id} consent={consent} />
          </div>
          <div className="flex min-w-[260px] flex-[0_1_340px] flex-col gap-4">
            <PublishChecklist projectId={id} checklist={checklist} advisorEmail={project.advisor_email} step="consent" />
            <Card tone="blue">
              <h2 className="mb-2 mt-0 text-base">What the advisor sees</h2>
              <p className="m-0 text-[15px] text-text-3">
                The title and summary, what becomes public, and what stays private. They can approve, say &ldquo;Not now&rdquo;, and add a comment.
              </p>
            </Card>
          </div>
        </div>
      </WizardFrame>
    );
  }

  if (current === "files") {
    const readable = files.filter((f) => f.extracted_text_path).length;
    const blockReason = !checklist.team.done
      ? "Every team member must confirm on the Consent step before ESTAFET reads your files."
      : "Your advisor must approve on the Consent step before ESTAFET reads your files.";
    return (
      <WizardFrame projectId={id} current="files">
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-6">
            <StepHeader
              title="Add your project files"
              intro="ESTAFET reads these files to draft a summary and the unfinished tasks. You review every item before anything is published. Files stay private."
            />
            <FilesStep
              projectId={id}
              files={files}
              itemCount={items.length}
              canSynthesize={checklist.team.done && checklist.advisor.done && readable > 0}
              blockReason={blockReason}
              mockMode={config.mode === "mock"}
            />
          </div>
          <div className="mt-[88px] flex min-w-[260px] flex-[0_1_340px] flex-col gap-4 max-lg:mt-0">
            <PublishChecklist projectId={id} checklist={checklist} advisorEmail={project.advisor_email} step="files" />
            <Card tone="blue">
              <h2 className="mb-2 mt-0 text-base">What becomes public</h2>
              <p className="m-0 text-[15px] text-text-3">
                Only the title, summary, objectives, verified next tasks and lessons you approve. Your files, code and notes stay private until you approve a request.
              </p>
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
            <strong>The last draft failed.</strong> {run.error}
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
  const published = project.status === "published" || project.status === "adopted";
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
  };
  const reason = !checklist.team.done
    ? "Every team member must confirm first."
    : !checklist.advisor.done
      ? "Your advisor has not approved yet."
      : !checklist.review.done
        ? "Review every drafted item and keep at least one."
        : "";

  return (
    <WizardFrame projectId={id} current="publish">
      <StepHeader
        title={published ? "Your teaser is live" : "Preview your public teaser"}
        intro={
          published
            ? "This is what visitors see. Your files stay private."
            : "This is exactly how visitors will see your project. Check it, then publish."
        }
      />
      {published ? (
        <Card tone="blue" className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-ok" aria-hidden="true" /> <strong>Published.</strong> Requests from other teams appear on your dashboard.
          </span>
          <ButtonLink href={`/projects/${project.slug}`} arrow>
            View public page
          </ButtonLink>
        </Card>
      ) : null}
      <div className="rounded-[36px] border border-dashed border-line-strong p-6 max-sm:p-3">
        <div className="mb-6 flex items-center gap-2">
          <Badge tone="info">Preview</Badge>
          <span className="text-sm text-text-2">Visitors cannot see this until you publish.</span>
        </div>
        <TeaserContent
          project={teaser}
          items={teaserItems}
          lineageSteps={[
            { id: "o", title: "Original team", sub: `Started ${project.year}`, state: "done" },
            { id: "p", title: "Published on ESTAFET", sub: published ? "Live" : "After you publish", state: published ? "done" : "next" },
            { id: "n", title: "Next team", sub: "Waiting for a continuation", state: "next" },
          ]}
          cta={
            <Card tone="lime" className="flex flex-col gap-2">
              <h2 className="m-0 text-xl">Want to continue this project?</h2>
              <p className="m-0 text-[15px] text-text-2">Adopters will see a &ldquo;Request to continue&rdquo; button here.</p>
            </Card>
          }
        />
      </div>
      {published ? null : <PublishBar projectId={id} ready={checklist.canPublish} reason={reason} />}
    </WizardFrame>
  );
}
