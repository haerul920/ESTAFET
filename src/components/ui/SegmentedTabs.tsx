"use client";

import { useId, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export interface TabDef {
  id: string;
  label: string;
  count?: number;
}

/** Accessible tab list with an animated underline. Arrow keys move between tabs. */
export function SegmentedTabs({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const group = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: React.KeyboardEvent, index: number) {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2 border-b border-line">
      {tabs.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${group}-tab-${t.id}`}
            aria-selected={active}
            aria-controls={`${group}-panel-${t.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative min-h-[44px] cursor-pointer px-4 py-3 text-base",
              active ? "font-semibold text-blue" : "font-medium text-text-2 hover:text-ink",
            )}
          >
            {t.label}
            {typeof t.count === "number" && t.count > 0 ? (
              <span className="ml-2 rounded-full bg-lime px-2 py-0.5 text-xs font-semibold text-black">{t.count}</span>
            ) : null}
            {active ? (
              <motion.span
                layoutId={`${group}-underline`}
                className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-blue"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function tabPanelProps(group: string, id: string) {
  return { role: "tabpanel", id: `${group}-panel-${id}`, "aria-labelledby": `${group}-tab-${id}` } as const;
}
