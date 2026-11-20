"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CreatorVerified, DemoBadge, Chip, Badge } from "@/components/ui/Badge";
import { AnimatedBar } from "@/components/ui/motion";
import { KIND_LABEL, STOP_REASON_LABEL } from "@/lib/labels";
import type { TeaserProject } from "@/lib/db/types";

export function ProjectCard({ project }: { project: TeaserProject }) {
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
      <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 22 }} className="h-full">
        <Link
          href={`/projects/${project.slug}`}
          className="flex h-full flex-col gap-3 rounded-[28px] border border-surface bg-surface p-6 text-ink no-underline transition-shadow hover:shadow-[0_18px_40px_rgba(10,60,150,0.12)]"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[13px] font-semibold text-text-2">
              {KIND_LABEL[project.kind]} · {project.year}
            </span>
            <CreatorVerified />
          </div>
          <h2 className="m-0 text-xl font-medium leading-tight">{project.title}</h2>
          <p className="m-0 text-[15px] text-text-2">{project.summary}</p>
          <div className="flex flex-wrap gap-2">
            <Chip>{project.field}</Chip>
            <Badge tone="warn" className="font-normal">
              {STOP_REASON_LABEL[project.stop_reason]}
            </Badge>
            {project.is_demo ? <DemoBadge /> : null}
          </div>
          <div className="mt-auto flex flex-col gap-1.5 pt-2">
            <AnimatedBar pct={pct} height={6} label={`${project.objectives_done} of ${project.objectives_total} objectives done`} />
            <div className="flex justify-between text-[13px] text-text-2">
              <span>
                {project.objectives_done} of {project.objectives_total} objectives done
              </span>
              <span>{project.tasks_count} verified next tasks</span>
            </div>
          </div>
        </Link>
      </motion.div>
    </motion.li>
  );
}
