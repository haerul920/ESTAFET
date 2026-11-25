import { formatDate } from "@/lib/format";
import type { TFn } from "@/lib/labels";
import type { LineageEvent, TeaserLineageEvent } from "@/lib/db/types";
import type { LineageStep } from "@/components/features/Lineage";

/**
 * Public lineage: original team, published, and who continued it (if anyone). Every line comes from what the
 * owners entered (start year, faculty) or from an event that happened. `faculty` is the label of their choice.
 * `t` is the `lineage` namespace.
 */
export function buildPublicLineage(
  project: { year: number; faculty: string },
  events: TeaserLineageEvent[],
  t: TFn,
  locale: string,
): LineageStep[] {
  const published = events.find((e) => e.type === "published");
  const continued = events.filter((e) => e.type === "continued");
  const steps: LineageStep[] = [
    {
      id: "origin",
      title: t("origin"),
      sub: [t("originSub", { year: project.year }), project.faculty].filter(Boolean).join(" · "),
      state: "done",
    },
  ];
  if (published) {
    steps.push({
      id: "published",
      title: t("published"),
      sub: formatDate(published.created_at, locale),
      state: "done",
    });
  }
  for (const c of continued) {
    steps.push({
      id: c.id,
      title: t("continued"),
      sub: `${c.team ? c.team + " · " : ""}${formatDate(c.created_at, locale)}`,
      state: "done",
    });
  }
  steps.push({
    id: "next",
    title: t("next"),
    sub: continued.length ? t("nextAfter") : t("nextWaiting"),
    state: "next",
  });
  return steps;
}

/** Full lineage for owners and people with access (private workspace). */
/** Events of the retired advisor flow (before R5) stay in the database but are not shown. */
const RETIRED = new Set<string>(["advisor_approved", "advisor_withdrawn"]);
export const visibleEvents = <T extends { type: string }>(events: T[]): T[] =>
  events.filter((e) => !RETIRED.has(e.type));

export function buildFullLineage(events: LineageEvent[], t: TFn, locale: string): LineageStep[] {
  return visibleEvents(events).map((e) => ({
    id: e.id,
    title: t(`events.${e.type}`),
    sub: formatDate(e.created_at, locale) + (typeof e.payload?.team === "string" ? ` · ${e.payload.team}` : ""),
    state: "done" as const,
  }));
}
