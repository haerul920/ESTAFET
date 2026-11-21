"use client";

import { motion } from "framer-motion";

/** 9 of 10 dots, popping in one by one. Decorative: the number is in the text next to it. */
export function SurveyDots({ filled, total }: { filled: number; total: number }) {
  return (
    <motion.div
      aria-hidden="true"
      className="flex gap-1.5"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
    >
      {Array.from({ length: total }, (_, i) => (
        <motion.span
          key={i}
          className={`h-[22px] w-[22px] rounded-full ${i < filled ? "bg-blue" : "bg-[#D3D6DA]"}`}
          variants={{
            hidden: { scale: 0 },
            show: { scale: 1, transition: { type: "spring", stiffness: 500, damping: 18 } },
          }}
        />
      ))}
    </motion.div>
  );
}
