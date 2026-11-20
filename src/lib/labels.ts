import type {
  Effort,
  ItemKind,
  LessonType,
  ObjectiveStatus,
  ProjectKind,
  ProjectStatus,
  RequestPurpose,
  RequestStatus,
  StopReason,
} from "@/lib/db/types";

export const KIND_LABEL: Record<ProjectKind, string> = {
  student_program: "Student creativity program",
  hackathon: "Hackathon",
  research: "Research project",
};

export const STOP_REASON_LABEL: Record<StopReason, string> = {
  funding_not_granted: "Funding not granted",
  team_graduated: "Team graduated",
  time_or_people: "Not enough time or people",
  other: "Other reason",
};

export const FACULTIES = [
  "Engineering",
  "Marine Science and Fisheries",
  "Forestry",
  "Public Health",
  "Agriculture",
  "Economics and Business",
  "Mathematics and Natural Sciences",
  "Other",
] as const;

export const EXPLORE_FACULTIES = ["Engineering", "Marine Science and Fisheries", "Forestry", "Public Health"] as const;

export const EFFORT_LABEL: Record<Effort, string> = { small: "Small", medium: "Medium", large: "Large" };

export const LESSON_LABEL: Record<LessonType, string> = {
  methodology: "Methodology",
  evaluation_feedback: "Evaluation feedback",
  funding_feedback: "Funding feedback",
  blocker: "Blocker",
};

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  objective: "Objective",
  completed: "Completed work",
  next_task: "Next task",
  lesson: "Lesson",
};

export const OBJECTIVE_LABEL: Record<ObjectiveStatus, string> = {
  done: "Done",
  in_progress: "In progress",
  not_started: "Not started",
};

export const PURPOSE_LABEL: Record<RequestPurpose, string> = {
  competition: "A student competition",
  research: "A research proposal",
  course: "A course project",
  other: "Something else",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Waiting for the creators",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Draft",
  awaiting_advisor: "Waiting for advisor",
  verifying: "Verifying",
  published: "Published",
  adopted: "Continued",
  archived: "Archived",
};

/** Pipeline stage index used by the dashboard (Draft, Advisor approval, Verify, Published, Continued). */
export function pipelineStage(status: ProjectStatus): number {
  switch (status) {
    case "draft":
      return 0;
    case "awaiting_advisor":
      return 1;
    case "verifying":
      return 2;
    case "published":
      return 3;
    case "adopted":
      return 4;
    default:
      return 3;
  }
}

export function formatMonthYear(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
