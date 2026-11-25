"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface StepDef {
  label: string;
  href?: string;
}

/** Step progress with `aria-current="step"`. Completed steps with an href are links. */
export function Stepper({
  steps,
  current,
  label,
  showNumbers = true,
}: {
  steps: StepDef[];
  current: number;
  label?: string;
  showNumbers?: boolean;
}) {
  const t = useTranslations("common");
  return (
    <nav aria-label={label ?? t("progress")} className="mb-8 max-sm:mb-6">
      <ol className="m-0 flex list-none flex-wrap gap-2 p-0 max-sm:grid max-sm:grid-cols-2 max-sm:gap-2.5">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const inner = (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <motion.div
                  className="h-1.5 w-full origin-left rounded-full bg-blue"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: i <= current ? 1 : 0 }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <div className="flex items-center gap-1.5">
                {showNumbers ? (
                  <span
                    className={cn(
                      "flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-semibold",
                      i <= current ? "bg-blue text-white" : "bg-chip text-text-2",
                    )}
                    aria-hidden="true"
                  >
                    {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                  </span>
                ) : null}
                <span className={cn("text-[14px] max-sm:text-[13.5px]", active ? "font-semibold" : "font-medium")}>
                  {s.label}
                </span>
              </div>
            </>
          );
          return (
            <li
              key={s.label}
              className="flex min-w-[130px] flex-1 flex-col gap-2 max-sm:min-w-0"
              aria-current={active ? "step" : undefined}
            >
              {done && s.href ? (
                <Link href={s.href} className="flex flex-col gap-2 no-underline text-ink hover:opacity-80">
                  {inner}
                </Link>
              ) : (
                <div className="flex flex-col gap-2">{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
