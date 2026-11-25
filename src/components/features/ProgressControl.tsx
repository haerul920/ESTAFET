"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { FormMessage } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { setItemProgress } from "@/app/actions/engage";
import { cn } from "@/lib/cn";

type Status = "none" | "in_progress" | "done";
const OPTIONS: Status[] = ["none", "in_progress", "done"];
const KEY = { none: "progressNone", in_progress: "progressDoing", done: "progressDone" } as const;

/** What owners see: how far the continuing team is with a task. There is nothing to press. */
export function ProgressStatus({ status }: { status: Status }) {
  const t = useTranslations("workspace");
  return (
    <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-text-2">
      {t("progressByTeam")}
      <Badge tone={status === "done" ? "ok" : status === "in_progress" ? "info" : "neutral"}>{t(KEY[status])}</Badge>
    </p>
  );
}

/**
 * The team that continues the project marks a suggested task "Dikerjakan" or "Selesai". The change is logged in the
 * lineage and the owners are told. The choice is a radio group, so the state is never shown by colour alone.
 */
export function ProgressControl({
  itemId,
  slug,
  status,
  title,
}: {
  itemId: string;
  slug: string;
  status: Status;
  title: string;
}) {
  const t = useTranslations("workspace");
  const router = useRouter();
  const [value, setValue] = useState<Status>(status);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function choose(next: Status) {
    if (next === value || pending) return;
    const before = value;
    setValue(next);
    start(async () => {
      setError("");
      const r = await setItemProgress(itemId, next, slug);
      if (r.error) {
        setValue(before);
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div role="radiogroup" aria-label={t("progressLabel", { title })} className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            disabled={pending}
            onClick={() => choose(o)}
            className={cn(
              "chip-hover min-h-[44px] cursor-pointer rounded-full border-[1.5px] px-4 text-sm font-semibold",
              value === o
                ? o === "done"
                  ? "border-ok bg-ok-bg text-ok"
                  : "border-blue bg-blue-tint text-blue-dark"
                : "border-line bg-white text-text-2 hover:bg-surface",
            )}
          >
            {value === o && o !== "none" ? "✓ " : ""}
            {t(KEY[o])}
          </button>
        ))}
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}
