"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export interface LineageStep {
  id: string;
  title: string;
  sub: string;
  /** done = filled blue dot, next = lime outline (what comes next). */
  state: "done" | "next";
}

/** Vertical lineage timeline, shared by the public teaser and the private workspace. */
export function Lineage({ steps, className }: { steps: LineageStep[]; className?: string }) {
  return (
    <motion.ol
      className={cn("m-0 flex list-none flex-col gap-3 p-0", className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
    >
      {steps.map((s, i) => (
        <motion.li
          key={s.id}
          className="relative flex items-start gap-3"
          variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
        >
          {i < steps.length - 1 ? (
            <span aria-hidden="true" className="absolute left-[5px] top-[18px] h-[calc(100%-2px)] w-px bg-line" />
          ) : null}
          <span
            aria-hidden="true"
            className={cn(
              "relative mt-1.5 box-border h-3 w-3 flex-none rounded-full",
              s.state === "done" ? "bg-blue" : "border-2 border-lime bg-white",
            )}
          />
          <span>
            <strong>{s.title}</strong>
            <br />
            <span className="text-sm text-text-2">{s.sub}</span>
          </span>
        </motion.li>
      ))}
    </motion.ol>
  );
}
