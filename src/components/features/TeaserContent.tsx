import { Link } from "@/i18n/navigation";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { Lineage, type LineageStep } from "@/components/features/Lineage";
import { useLabels } from "@/lib/use-labels";
import type { TeaserItem, TeaserProject } from "@/lib/db/types";

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
  const tasks = items.filter((i) => i.kind === "next_task");
  const lessons = items.filter((i) => i.kind === "lesson");
  const words = [project.summary, ...items.map((i) => `${i.title} ${i.description}`)].join(" ").split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));

  return (
    <>
      <header className="mb-8">
        <h1 className="mb-3 mt-0 text-[44px] font-medium leading-[1.1] max-sm:text-[32px]">{project.title}</h1>
        <p className="m-0 text-text-2">
          {L.kind[project.kind]} · {project.year} · {L.faculty(project.field)} ·{" "}
          {t("byTeam", { count: project.team_size })} · {t("readTime", { minutes })}
        </p>
      </header>

      {/* One column, in reading order. */}
      <div className="flex flex-col gap-6">
        <Reveal>
          <Card as="section">
            <h2 className="mb-2 mt-0 text-[22px]">{t("what")}</h2>
            <p className="m-0 text-text-3">{project.summary}</p>
          </Card>
        </Reveal>

        {project.stopped_note ? (
          <Reveal>
            <Card as="section" tone="warn">
              <h2 className="mb-2 mt-0 text-[22px] text-warn-ink">{t("stopped")}</h2>
              <p className="m-0 text-warn-ink">{project.stopped_note}</p>
            </Card>
          </Reveal>
        ) : null}

        <Reveal>
          <Card as="section">
            <h2 className="mb-1 mt-0 text-[22px]">{t("nextTasks")}</h2>
            <p className="mb-4 mt-0 text-sm text-text-2">{t("nextTasksIntro")}</p>
            {tasks.length === 0 ? (
              <p className="m-0 text-text-2">{t("noTasks")}</p>
            ) : (
              <Stagger as="ol" gap={0.08} className="m-0 flex list-none flex-col gap-3 p-0">
                {tasks.map((task) => (
                  <StaggerItem
                    as="li"
                    key={task.id}
                    className="flex flex-col gap-2 rounded-[18px] border border-line-soft bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <strong>{task.title}</strong>
                    </div>
                    {task.description ? <span className="text-[15px] text-text-2">{task.description}</span> : null}
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
                    <span className="text-[13px] font-semibold text-blue-dark">
                      {l.lesson_type ? L.lesson[l.lesson_type] : t("lessonDefault")}
                    </span>
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
                  {t("lockedBase")} {project.access_mode === "open" ? t("lockedOpen") : t("lockedRequest")}
                </p>
              )}
            </div>
          </Card>
        </Reveal>

        <Reveal>
          <Card>
            <h2 className="mb-3 mt-0 text-base">{t("lineage")}</h2>
            <Lineage steps={lineageSteps} />
          </Card>
        </Reveal>

        {/* Last on purpose: read the project first, then decide to continue it. */}
        <Reveal>{cta}</Reveal>
      </div>
    </>
  );
}
