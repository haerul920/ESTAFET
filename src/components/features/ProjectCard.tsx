"use client";

import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { Chip } from "@/components/ui/Badge";
import { useLabels } from "@/lib/use-labels";
import type { TeaserProject } from "@/lib/db/types";
import { kindName } from "@/lib/basics";

export function ProjectCard({ project }: { project: TeaserProject }) {
  const L = useLabels();
  return (
    <motion.li
      layout
      className="list-none"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 360, damping: 26 }}
    >
      <div className="h-full">
        <Link
          href={`/projects/${project.slug}`}
          className="lift flex h-full flex-col gap-3 rounded-[28px] border border-surface bg-surface p-6 text-ink no-underline"
        >
          <span className="text-[13px] font-semibold text-text-2">
            {kindName(project, L.kind)} · {project.year}
          </span>
          <h2 className="m-0 line-clamp-2 text-xl font-medium leading-tight">{project.title}</h2>
          {/* A long description stops after four lines and ends with "…", so a card never grows tall. */}
          <p className="m-0 line-clamp-4 text-[15px] text-text-2">{project.summary}</p>
          {/* The faculty sits at the bottom, so the cards of one row line up. */}
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <Chip>{L.faculty(project.field)}</Chip>
          </div>
        </Link>
      </div>
    </motion.li>
  );
}
