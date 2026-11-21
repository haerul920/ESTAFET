"use client";

import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { OwnerVerified, DemoBadge, Chip, Badge } from "@/components/ui/Badge";
import { AnimatedBar } from "@/components/ui/motion";
import { useLabels } from "@/lib/use-labels";
import type { TeaserProject } from "@/lib/db/types";

export function ProjectCard({ project }: { project: TeaserProject }) {
  const t = useTranslations("card");
  const L = useLabels();
  const pct = project.objectives_total ? Math.round((project.objectives_done / project.objectives_total) * 100) : 0;
  return (
    <motion.li
      layout
      className="list-none"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="h-full">
        <Link
          href={`/projects/${project.slug}`}
          className="lift flex h-full flex-col gap-3 rounded-[28px] border border-surface bg-surface p-6 text-ink no-underline"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[13px] font-semibold text-text-2">
              {L.kind[project.kind]} · {project.year}
            </span>
            <OwnerVerified />
          </div>
          <h2 className="m-0 text-xl font-medium leading-tight">{project.title}</h2>
          <p className="m-0 text-[15px] text-text-2">{project.summary}</p>
          <div className="flex flex-wrap gap-2">
            <Chip>{L.faculty(project.field)}</Chip>
            <Badge tone="warn" className="font-normal">
              {L.stopReason[project.stop_reason]}
            </Badge>
            {project.is_demo ? <DemoBadge /> : null}
          </div>
          <div className="mt-auto flex flex-col gap-1.5 pt-2">
            <AnimatedBar pct={pct} height={6} label={t("objectivesDone", { done: project.objectives_done, total: project.objectives_total })} />
            <div className="flex justify-between text-[13px] text-text-2">
              <span>{t("objectivesDone", { done: project.objectives_done, total: project.objectives_total })}</span>
              <span>{t("tasks", { count: project.tasks_count })}</span>
            </div>
          </div>
        </Link>
      </div>
    </motion.li>
  );
}
