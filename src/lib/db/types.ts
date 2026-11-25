// Row shapes returned by Supabase queries. Kept in sync with supabase/migrations by hand.

/** The types of work, in the order the pickers list them. "other" stays last. */
export const PROJECT_KINDS = ["student_program", "hackathon", "research", "community_service", "other"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];
export type ProjectStatus = "draft" | "published" | "unpublished" | "archived";
export type ModerationStatus = "ok" | "held" | "hidden" | "removed";
export type AccessMode = "open" | "by_request";
export type MemberRole = "owner" | "co_owner";
export type MemberStatus = "invited" | "active" | "left";
export type AccessSource = "open" | "approved_request";
export type AccessStatus = "active" | "revoked";
export type ItemKind = "objective" | "completed" | "next_task" | "lesson";
export type LessonType = "methodology" | "evaluation_feedback" | "funding_feedback" | "blocker";
export type EvidenceStatus = "matched" | "not_found" | "partial";
export type ReviewStatus = "pending" | "kept" | "removed";
export type ObjectiveStatus = "done" | "in_progress" | "not_started";
export type RequestStatus = "pending" | "approved" | "declined" | "withdrawn" | "expired";
export type RequestPurpose = "competition" | "research" | "course" | "other";
export type ConsentStatus = "pending" | "approved" | "declined" | "withdrawn";
export type LineageType =
  | "created"
  | "advisor_approved"
  | "published"
  | "requested"
  | "approved"
  | "agreement_signed"
  | "continued"
  | "resubmitted"
  | "declined"
  | "advisor_withdrawn"
  | "access_taken"
  | "access_revoked"
  | "request_expired"
  | "unpublished"
  | "republished"
  | "archived"
  | "access_settings_changed"
  | "item_progress"
  | "ownership_transferred";

export interface Profile {
  id: string;
  full_name: string;
  university: string;
  faculty: string | null;
  study_program: string | null;
  avatar_url: string | null;
  is_admin?: boolean;
  suspended_at?: string | null;
  suspended_reason?: string | null;
  suspended_until?: string | null;
}

export interface TeaserProject {
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: ProjectKind;
  /** The owner's own name for the kind of work when kind is "other", otherwise null. */
  kind_other: string | null;
  field: string;
  year: number;
  status: ProjectStatus;
  is_demo: boolean;
  published_at: string | null;
  stopped_note: string;
  tech: string[];
  team_size: number;
  objectives_total: number;
  objectives_done: number;
  tasks_count: number;
  access_mode: AccessMode;
  /** null means unlimited */
  max_active_adopters: number | null;
  active_adopters: number;
}

export interface TeaserItem {
  id: string;
  project_id: string;
  kind: ItemKind;
  title: string;
  description: string;
  lesson_type: LessonType | null;
  objective_status: ObjectiveStatus | null;
  position: number;
  source_label: string | null;
}

export interface TeaserLineageEvent {
  id: string;
  project_id: string;
  type: LineageType;
  created_at: string;
  team: string | null;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: ProjectKind;
  /** The owner's own name for the kind of work when kind is "other", otherwise null. */
  kind_other: string | null;
  field: string;
  year: number;
  status: ProjectStatus;
  created_by: string;
  is_demo: boolean;
  published_at: string | null;
  stopped_note: string;
  tech: string[];
  team_size: number;
  moderation_status?: ModerationStatus;
  moderation_reason?: string | null;
  access_mode: AccessMode;
  max_active_adopters: number | null;
  /** null = not chosen yet. manual = the owners write the items by hand and nothing goes to AI. */
  fill_mode?: "ai" | "manual" | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  profile_id: string;
  role: MemberRole;
  status: MemberStatus;
  consented_at: string | null;
  profiles?: Pick<Profile, "full_name"> | null;
}

export interface EvidenceRef {
  file_id: string;
  page: number;
  quote: string;
}

export interface DraftItem {
  id: string;
  project_id: string;
  run_id: string | null;
  kind: ItemKind;
  title: string;
  description: string;
  lesson_type: LessonType | null;
  objective_status: ObjectiveStatus | null;
  evidence: EvidenceRef[];
  evidence_status: EvidenceStatus;
  origin: "ai" | "creator";
  review_status: ReviewStatus;
  position: number;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  kind: "pdf" | "markdown" | "image" | "word" | "spreadsheet" | "slides" | "code_tree";
  storage_path: string;
  original_name: string;
  size_bytes: number;
  page_count: number | null;
  extracted_text_path: string | null;
  skipped_sensitive: { name: string; reason: string }[];
  ingest_status: "ready" | "check";
  ingest_note: string;
  created_at: string;
}

export interface ContinuationRequest {
  id: string;
  project_id: string;
  adopter_team_name: string;
  members: { email: string }[];
  task_ids: string[];
  plan: string;
  purpose: RequestPurpose;
  target_date: string | null;
  fit_note: string;
  status: RequestStatus;
  decision_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
}

export interface ProjectAccess {
  id: string;
  project_id: string;
  profile_id: string;
  source: AccessSource;
  status: AccessStatus;
  agreement_version: number;
  accepted_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  request_id: string | null;
}

export interface AgreementAcceptance {
  id: string;
  request_id: string;
  profile_id: string;
  side: "creator" | "adopter";
  agreement_version: number;
  accepted_at: string;
}

export interface LineageEvent {
  id: string;
  project_id: string;
  type: LineageType;
  actor_id: string | null;
  request_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface SynthesisRun {
  id: string;
  project_id: string;
  provider: string;
  model: string;
  mode: "live" | "mock";
  status: "queued" | "running" | "done" | "failed";
  error: string | null;
  created_at: string;
}
