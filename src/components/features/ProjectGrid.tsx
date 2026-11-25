"use client";

import { AnimatePresence } from "framer-motion";
import { ProjectCard } from "./ProjectCard";
import type { TeaserProject } from "@/lib/db/types";

export function ProjectGrid({ projects }: { projects: TeaserProject[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-0">
      <AnimatePresence mode="popLayout">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
