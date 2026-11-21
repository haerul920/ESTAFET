import { formatDate, formatMonthYear } from "@/lib/labels";
import type { LineageEvent, TeaserLineageEvent } from "@/lib/db/types";
import type { LineageStep } from "@/components/features/Lineage";

/** Public lineage: original team, published, and who continued it (if anyone). */
export function buildPublicLineage(
  project: { year: number; is_demo: boolean },
  events: TeaserLineageEvent[],
): LineageStep[] {
  const published = events.find((e) => e.type === "published");
  const continued = events.filter((e) => e.type === "continued");
  const steps: LineageStep[] = [
    { id: "origin", title: "Original team", sub: `Started ${project.year}`, state: "done" },
  ];
  if (published) {
    steps.push({
      id: "published",
      title: "Published on ESTAFET",
      sub: `${formatMonthYear(published.created_at)}${project.is_demo ? " (demo)" : ""}`,
      state: "done",
    });
  }
  for (const c of continued) {
    steps.push({
      id: c.id,
      title: "Continued by another team",
      sub: `${c.team ? c.team + " · " : ""}${formatMonthYear(c.created_at)}`,
      state: "done",
    });
  }
  steps.push({
    id: "next",
    title: "Next team",
    sub: continued.length ? "Open to another continuation after this one" : "Waiting for a continuation",
    state: "next",
  });
  return steps;
}

const EVENT_TITLE: Record<string, string> = {
  created: "Project created",
  advisor_approved: "Advisor approved publishing",
  advisor_withdrawn: "Advisor withdrew approval",
  published: "Published on ESTAFET",
  requested: "Continuation requested",
  approved: "Request approved by the creators",
  declined: "Request declined or withdrawn",
  agreement_signed: "Attribution agreement accepted",
  continued: "Handed over: files unlocked",
  resubmitted: "Resubmitted",
  access_taken: "A team took access",
  access_revoked: "Access was revoked by the owners",
  request_expired: "Request expired without a decision",
  unpublished: "Teaser unpublished by the owners",
  republished: "Teaser published again",
  archived: "Project archived by the owners",
  access_settings_changed: "Access settings changed by the owners",
};

/** Full lineage for creators and approved adopters (private workspace). */
export function buildFullLineage(events: LineageEvent[]): LineageStep[] {
  return events.map((e) => ({
    id: e.id,
    title: EVENT_TITLE[e.type] ?? e.type,
    sub: formatDate(e.created_at) + (typeof e.payload?.team === "string" ? ` · ${e.payload.team}` : ""),
    state: "done" as const,
  }));
}
