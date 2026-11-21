"use client";

import * as RTabs from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/cn";

export interface TabDef {
  id: string;
  label: string;
  count?: number;
}

/**
 * Tabs on Radix (roving focus, arrow keys, Home and End, correct ARIA) with an animated underline.
 * `children` is the panel for the selected tab and slides in when the tab changes.
 */
export function SegmentedTabs({
  tabs,
  value,
  onChange,
  label,
  children,
}: {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  const group = useId();
  return (
    <RTabs.Root value={value} onValueChange={onChange}>
      <RTabs.List aria-label={label} className="mb-4 flex flex-wrap gap-2 border-b border-line">
        {tabs.map((t) => {
          const active = t.id === value;
          return (
            <RTabs.Trigger
              key={t.id}
              value={t.id}
              className={cn(
                "relative min-h-[44px] cursor-pointer px-4 py-3 text-base",
                active ? "font-semibold text-blue" : "font-medium text-text-2 hover:text-ink",
              )}
            >
              {t.label}
              {typeof t.count === "number" && t.count > 0 ? (
                <span className="chip-hover ml-2 rounded-full bg-lime px-2 py-0.5 text-xs font-semibold text-black">
                  {t.count}
                </span>
              ) : null}
              {active ? (
                <motion.span
                  layoutId={`${group}-underline`}
                  className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-blue"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              ) : null}
            </RTabs.Trigger>
          );
        })}
      </RTabs.List>
      <RTabs.Content key={value} value={value} className="slide-in outline-none">
        {children}
      </RTabs.Content>
    </RTabs.Root>
  );
}
