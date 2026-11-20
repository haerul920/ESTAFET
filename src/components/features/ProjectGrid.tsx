"use client";

import { AnimatePresence } from "framer-motion";
import { ProjectCard } from "./ProjectCard";
import type { TeaserProject } from "@/lib/db/types";

export function ProjectGrid({ projects }: { projects: TeaserProject[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4 p-0">
      <AnimatePresence mode="popLayout">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
