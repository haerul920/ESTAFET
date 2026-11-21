import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ContinuationRequest, ProjectAccess, ProjectStatus } from "./types";

export interface RequestProject {
  id: string;
  slug: string;
  title: string;
  is_demo: boolean;
  status: ProjectStatus;
}

export interface RequestTask {
  id: string;
  title: string;
}

export interface AccessHolder {
  accessId: string;
  profileId: string;
  name: string;
  acceptedAt: string;
  status: ProjectAccess["status"];
}

export interface RequestDetail {
  request: ContinuationRequest;
  project: RequestProject;
  tasks: RequestTask[];
  requesterName: string;
  ownerNames: string[];
  /** People who accepted the agreement for this request (each one holds their own access). */
  holders: AccessHolder[];
  isOwner: boolean;
  isTeam: boolean;
  /** The signed-in user's own access that came from this request, if any. */
  myAccess: ProjectAccess | null;
  /** True when somebody from this request holds active access. */
  unlocked: boolean;
}

/**
 * Everything the review and agreement page needs.
 * Access to the request row is decided by RLS as the signed-in user. Only after that row is returned
 * does the server read the project and task titles with the service role, so unpublished projects still work.
 */
export async function getRequestDetail(id: string, userId: string): Promise<RequestDetail | null> {
  const supabase = await createClient();
  const { data: request } = await supabase.from("continuation_requests").select("*").eq("id", id).maybeSingle();
  if (!request) return null;
  const req = request as ContinuationRequest;

  const [{ data: isOwner }, { data: isTeam }] = await Promise.all([
    supabase.rpc("is_project_owner", { pid: req.project_id }),
    supabase.rpc("is_request_team", { rid: id }),
  ]);

  const admin = createAdminClient();
  const [{ data: project }, { data: tasks }, { data: owners }, { data: access }] = await Promise.all([
    admin.from("projects").select("id, slug, title, is_demo, status").eq("id", req.project_id).maybeSingle(),
    admin
      .from("draft_items")
      .select("id, title")
      .in("id", req.task_ids.length ? req.task_ids : ["00000000-0000-0000-0000-000000000000"])
      .eq("review_status", "kept"),
    admin.from("project_members").select("profile_id").eq("project_id", req.project_id).eq("status", "active"),
    admin.from("project_access").select("*").eq("request_id", id).order("accepted_at", { ascending: true }),
  ]);
  if (!project) return null;

  const holders = (access ?? []) as ProjectAccess[];
  const profileIds = [...new Set([req.created_by, ...holders.map((h) => h.profile_id), ...(owners ?? []).map((o: { profile_id: string }) => o.profile_id)])];
  const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", profileIds);
  const nameOf = new Map((profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));

  return {
    request: req,
    project: project as RequestProject,
    tasks: (tasks ?? []) as RequestTask[],
    requesterName: nameOf.get(req.created_by) ?? "",
    ownerNames: (owners ?? []).map((o: { profile_id: string }) => nameOf.get(o.profile_id) ?? "").filter(Boolean),
    holders: holders.map((h) => ({ accessId: h.id, profileId: h.profile_id, name: nameOf.get(h.profile_id) ?? "—", acceptedAt: h.accepted_at, status: h.status })),
    isOwner: isOwner === true,
    isTeam: isTeam === true,
    myAccess: holders.find((h) => h.profile_id === userId && h.status === "active") ?? null,
    unlocked: holders.some((h) => h.status === "active"),
  };
}

export interface RequestMessageRow {
  id: string;
  authorId: string;
  authorName: string;
  fromOwner: boolean;
  body: string;
  createdAt: string;
}

/**
 * The thread for a request. Visibility is decided by RLS as the signed-in user (owners and the requesting team only).
 * Names come from the service role after that.
 */
export async function getRequestMessages(requestId: string, projectId: string): Promise<RequestMessageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("request_messages")
    .select("id, author_id, body, created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const admin = createAdminClient();
  const ids = [...new Set(rows.map((r) => r.author_id as string))];
  const [{ data: profiles }, { data: owners }] = await Promise.all([
    admin.from("profiles").select("id, full_name").in("id", ids),
    admin.from("project_members").select("profile_id").eq("project_id", projectId).eq("status", "active"),
  ]);
  const nameOf = new Map((profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
  const ownerIds = new Set((owners ?? []).map((o: { profile_id: string }) => o.profile_id));
  return rows.map((r) => ({
    id: r.id as string,
    authorId: r.author_id as string,
    authorName: nameOf.get(r.author_id as string) ?? "—",
    fromOwner: ownerIds.has(r.author_id as string),
    body: r.body as string,
    createdAt: r.created_at as string,
  }));
}
