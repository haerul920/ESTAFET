import { PROJECT_KINDS } from "@/lib/db/types";
import type {
  AccessMode,
  ItemKind,
  LessonType,
  ObjectiveStatus,
  ProjectStatus,
  RequestPurpose,
  RequestStatus,
} from "@/lib/db/types";

/** A translator for one namespace. next-intl's `t` fits this shape. */
export type TFn = (key: string, values?: Record<string, string | number | Date>) => string;

/** Faculty names are stored as data (English names). They are shown through `labels.faculty.*`. */
export const FACULTIES = [
  "Economics and Business",
  "Law",
  "Medicine",
  "Engineering",
  "Social and Political Sciences",
  "Cultural Sciences",
  "Agriculture",
  "Mathematics and Natural Sciences",
  "Animal Science",
  "Dentistry",
  "Public Health",
  "Marine Science and Fisheries",
  "Forestry",
  "Pharmacy",
  "Nursing",
  "Vocational Studies",
  "Agricultural Technology",
] as const;

const FACULTY_KEY: Record<string, string> = {
  "Economics and Business": "economics",
  Law: "law",
  Medicine: "medicine",
  Engineering: "engineering",
  "Social and Political Sciences": "socialPolitical",
  "Cultural Sciences": "cultural",
  Agriculture: "agriculture",
  "Mathematics and Natural Sciences": "math",
  "Animal Science": "animalScience",
  Dentistry: "dentistry",
  "Public Health": "publicHealth",
  "Marine Science and Fisheries": "marine",
  Forestry: "forestry",
  Pharmacy: "pharmacy",
  Nursing: "nursing",
  "Vocational Studies": "vocational",
  "Agricultural Technology": "agriculturalTech",
  Other: "other",
};

const LESSONS = [
  "methodology",
  "evaluation_feedback",
  "funding_feedback",
  "blocker",
] as const satisfies readonly LessonType[];
const ITEM_KINDS = ["objective", "completed", "next_task", "lesson"] as const satisfies readonly ItemKind[];
const OBJECTIVES = ["done", "in_progress", "not_started"] as const satisfies readonly ObjectiveStatus[];
const PURPOSES = ["competition", "research", "course", "other"] as const satisfies readonly RequestPurpose[];
const REQUEST_STATUSES = [
  "pending",
  "approved",
  "declined",
  "withdrawn",
  "expired",
] as const satisfies readonly RequestStatus[];
const PROJECT_STATUSES = ["draft", "published", "unpublished", "archived"] as const satisfies readonly ProjectStatus[];
const ACCESS_MODES = ["open", "by_request"] as const satisfies readonly AccessMode[];
const FILE_KINDS = ["pdf", "markdown", "image", "word", "spreadsheet", "slides", "code_tree"] as const;

/** Builds every enum label for one language. `t` is the translator for the `labels` namespace. */
export function buildLabels(t: TFn) {
  const rec = <K extends string>(ns: string, keys: readonly K[]) =>
    Object.fromEntries(keys.map((k) => [k, t(`${ns}.${k}`)])) as Record<K, string>;
  return {
    kind: rec("kind", PROJECT_KINDS),
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
