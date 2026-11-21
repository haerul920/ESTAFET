import type {
  AccessMode,
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

/** A translator for one namespace. next-intl's `t` fits this shape. */
export type TFn = (key: string, values?: Record<string, string | number | Date>) => string;

/** Faculty names are stored as data (English names). They are shown through `labels.faculty.*`. */
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

const FACULTY_KEY: Record<string, string> = {
  Engineering: "engineering",
  "Marine Science and Fisheries": "marine",
  Forestry: "forestry",
  "Public Health": "publicHealth",
  Agriculture: "agriculture",
  "Economics and Business": "economics",
  "Mathematics and Natural Sciences": "math",
  Other: "other",
};

const KINDS = ["student_program", "hackathon", "research"] as const satisfies readonly ProjectKind[];
const REASONS = ["funding_not_granted", "team_graduated", "time_or_people", "other"] as const satisfies readonly StopReason[];
const EFFORTS = ["small", "medium", "large"] as const satisfies readonly Effort[];
const LESSONS = ["methodology", "evaluation_feedback", "funding_feedback", "blocker"] as const satisfies readonly LessonType[];
const ITEM_KINDS = ["objective", "completed", "next_task", "lesson"] as const satisfies readonly ItemKind[];
const OBJECTIVES = ["done", "in_progress", "not_started"] as const satisfies readonly ObjectiveStatus[];
const PURPOSES = ["competition", "research", "course", "other"] as const satisfies readonly RequestPurpose[];
const REQUEST_STATUSES = ["pending", "approved", "declined", "withdrawn", "expired"] as const satisfies readonly RequestStatus[];
const PROJECT_STATUSES = ["draft", "published", "unpublished", "archived"] as const satisfies readonly ProjectStatus[];
const ACCESS_MODES = ["open", "by_request", "paused"] as const satisfies readonly AccessMode[];
const FILE_KINDS = ["pdf", "markdown", "code_tree"] as const;

/** Builds every enum label for one language. `t` is the translator for the `labels` namespace. */
export function buildLabels(t: TFn) {
  const rec = <K extends string>(ns: string, keys: readonly K[]) =>
    Object.fromEntries(keys.map((k) => [k, t(`${ns}.${k}`)])) as Record<K, string>;
  return {
    kind: rec("kind", KINDS),
    stopReason: rec("stopReason", REASONS),
    effort: rec("effort", EFFORTS),
    lesson: rec("lesson", LESSONS),
    itemKind: rec("itemKind", ITEM_KINDS),
    objective: rec("objective", OBJECTIVES),
    purpose: rec("purpose", PURPOSES),
    requestStatus: rec("requestStatus", REQUEST_STATUSES),
    projectStatus: rec("projectStatus", PROJECT_STATUSES),
    accessMode: rec("accessMode", ACCESS_MODES),
    fileKind: rec("fileKind", FILE_KINDS),
    /** The label of a stored faculty name. Names that are not in the list are shown as they were typed. */
    faculty: (value: string) => (FACULTY_KEY[value] ? t(`faculty.${FACULTY_KEY[value]}`) : value),
  };
}

export type Labels = ReturnType<typeof buildLabels>;
