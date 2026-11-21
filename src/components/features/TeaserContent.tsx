import { Link } from "@/i18n/navigation";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { AdvisorApproved, Badge, Chip, OwnerVerified, DemoBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AnimatedBar, Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { Lineage, type LineageStep } from "@/components/features/Lineage";
import { useLabels } from "@/lib/use-labels";
import type { ObjectiveStatus, TeaserItem, TeaserProject } from "@/lib/db/types";

const OBJ_TONE: Record<ObjectiveStatus, "ok" | "info" | "neutral"> = {
  done: "ok",
  in_progress: "info",
  not_started: "neutral",
};

/**
 * The public project teaser body. Used by /projects/[slug] and by the Publish step preview,
 * so what the creator previews is exactly what visitors see.
 */
export function TeaserContent({
  project,
  items,
  lineageSteps,
  cta,
  unlockedHref,
}: {
  project: TeaserProject;
  items: TeaserItem[];
  lineageSteps: LineageStep[];
  cta: React.ReactNode;
  unlockedHref?: string;
}) {
  const t = useTranslations("teaser");
  const L = useLabels();
  const objectives = items.filter((i) => i.kind === "objective");
  const completed = items.filter((i) => i.kind === "completed");
  const tasks = items.filter((i) => i.kind === "next_task");
  const lessons = items.filter((i) => i.kind === "lesson");
  const words = [project.summary, ...items.map((i) => `${i.title} ${i.description}`)].join(" ").split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  const pct = project.objectives_total ? Math.round((project.objectives_done / project.objectives_total) * 100) : 0;

  return (
    <>
      <header className="mb-8">
        <div className="mb-3 flex flex-wrap gap-2">
          <OwnerVerified />
          {project.no_advisor ? <Badge tone="neutral">{t("noAdvisorBadge")}</Badge> : <AdvisorApproved />}
          {project.is_demo ? <DemoBadge /> : null}
        </div>
        <h1 className="mb-3 mt-0 text-[44px] font-medium leading-[1.1] max-sm:text-[32px]">{project.title}</h1>
        <p className="m-0 text-text-2">
          {L.kind[project.kind]} · {project.year} · {L.faculty(project.field)} · {t("byTeam", { count: project.team_size })} ·{" "}
          {t("advisor", { name: project.advisor_name || t("advisorNone") })} · {t("readTime", { minutes })}
        </p>
      </header>

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-6">
          <Reveal>
            <Card as="section">
              <h2 className="mb-2 mt-0 text-[22px]">{t("what")}</h2>
              <p className="m-0 text-text-3">{project.summary}</p>
            </Card>
          </Reveal>

          <Reveal>
            <Card as="section">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="m-0 text-[22px]">{t("stands")}</h2>
                <span className="text-sm text-text-2">
                  {t("doneOf", { done: project.objectives_done, total: project.objectives_total })}
                </span>
              </div>
              <AnimatedBar pct={pct} className="mb-5" label={t("objectivesBar")} />
              {objectives.length === 0 ? (
                <p className="m-0 text-text-2">{t("noObjectives")}</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {objectives.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft pb-3">
                      <span>{o.title}</span>
                      <Badge tone={OBJ_TONE[o.objective_status ?? "not_started"]}>
                        {L.objective[o.objective_status ?? "not_started"]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              {completed.length > 0 ? (
                <div className="mt-5">
                  <h3 className="mb-2 mt-0 text-base">{t("completed")}</h3>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {completed.map((c) => (
                      <li key={c.id} className="text-[15px]">
                        <strong>{c.title}</strong>
                        {c.description ? <span className="text-text-2"> · {c.description}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {project.stopped_note ? (
                <div className="mt-4 rounded-[14px] bg-warn-bg p-4 text-warn-ink">
                  <strong>{t("stopped")}</strong> {project.stopped_note}
                </div>
              ) : null}
            </Card>
          </Reveal>

          <Reveal>
            <Card as="section">
              <h2 className="mb-1 mt-0 text-[22px]">{t("nextTasks")}</h2>
              <p className="mb-4 mt-0 text-sm text-text-2">
                {t("nextTasksIntro")}
              </p>
              {tasks.length === 0 ? (
                <p className="m-0 text-text-2">{t("noTasks")}</p>
              ) : (
                <Stagger as="ol" gap={0.08} className="m-0 flex list-none flex-col gap-3 p-0">
                  {tasks.map((task) => (
                    <StaggerItem as="li" key={task.id} className="flex flex-col gap-2 rounded-[18px] border border-line-soft bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <strong>{task.title}</strong>
                        {task.effort ? <Chip className="font-semibold">{L.effort[task.effort]}</Chip> : null}
                      </div>
                      {task.description ? <span className="text-[15px] text-text-2">{task.description}</span> : null}
                      {task.source_label ? <span className="text-[13px] font-semibold text-blue-dark">{t("source", { label: task.source_label })}</span> : null}
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </Card>
          </Reveal>

          {lessons.length > 0 ? (
            <Reveal>
              <Card as="section">
                <h2 className="mb-4 mt-0 text-[22px]">{t("learned")}</h2>
                <ul className="m-0 flex list-none flex-col gap-4 p-0">
                  {lessons.map((l) => (
                    <li key={l.id} className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-semibold text-blue-dark">{l.lesson_type ? L.lesson[l.lesson_type] : t("lessonDefault")}</span>
                      <span>{l.title}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          ) : null}

          <Reveal>
            <Card as="section" tone="dashed" className="flex items-start gap-4">
              <Lock size={28} className="mt-0.5 flex-none text-text-2" aria-hidden="true" />
              <div>
                <h2 className="mb-1 mt-0 text-lg">{t("privateFiles")}</h2>
                {unlockedHref ? (
                  <p className="m-0 text-text-2">
                    {t("hasAccess")}{" "}
                    <Link href={unlockedHref} className="font-semibold">
                      {t("openWorkspace")}
                    </Link>
                    .
                  </p>
                ) : (
                  <p className="m-0 text-text-2">
                    {t("lockedBase")}{" "}
                    {project.access_mode === "open" ? t("lockedOpen") : project.access_mode === "paused" ? t("lockedPaused") : t("lockedRequest")}
                  </p>
                )}
              </div>
            </Card>
          </Reveal>
        </div>

        <aside className="flex min-w-[260px] flex-[0_1_320px] flex-col gap-4">
          <Reveal>{cta}</Reveal>
          {project.tech.length > 0 ? (
            <Reveal>
              <Card>
                <h2 className="mb-3 mt-0 text-base">{t("builtWith")}</h2>
                <div className="flex flex-wrap gap-2">
                  {project.tech.map((tech) => (
                    <Chip key={tech}>{tech}</Chip>
                  ))}
                </div>
              </Card>
            </Reveal>
          ) : null}
          <Reveal>
            <Card>
              <h2 className="mb-3 mt-0 text-base">{t("lineage")}</h2>
              <Lineage steps={lineageSteps} />
            </Card>
          </Reveal>
        </aside>
      </div>
    </>
  );
}
