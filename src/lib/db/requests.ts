import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AGREEMENT_VERSION } from "@/lib/agreement/terms";
import type { AgreementAcceptance, ContinuationRequest, TeaserItem, TeaserProject } from "./types";

export interface RequestDetail {
  request: ContinuationRequest;
  project: TeaserProject;
  tasks: TeaserItem[];
  requesterName: string;
  creatorNames: string[];
  acceptances: (AgreementAcceptance & { name: string })[];
  isCreator: boolean;
  isTeam: boolean;
  unlocked: boolean;
  creatorAccepted: boolean;
  adopterAccepted: boolean;
  /** Request that this signed-in user personally accepted (to disable the checkbox). */
  mineAccepted: boolean;
}

/** Everything the review and agreement page needs. All reads go through RLS as the signed-in user. */
export async function getRequestDetail(id: string, userId: string): Promise<RequestDetail | null> {
  const supabase = await createClient();
  const { data: request } = await supabase.from("continuation_requests").select("*").eq("id", id).maybeSingle();
  if (!request) return null;
  const req = request as ContinuationRequest;

  const [{ data: project }, { data: tasks }, { data: acc }, { data: isCreator }, { data: isTeam }, { data: unlocked }] =
    await Promise.all([
      supabase.from("public_project_teaser").select("*").eq("id", req.project_id).maybeSingle(),
      supabase.from("public_teaser_items").select("*").in("id", req.task_ids.length ? req.task_ids : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("agreement_acceptances").select("*").eq("request_id", id),
      supabase.rpc("is_project_creator", { pid: req.project_id }),
      supabase.rpc("is_request_team", { rid: id }),
      supabase.rpc("request_unlocked", { rid: id }),
    ]);
  if (!project) return null;

  const { data: creators } = await supabase
    .from("project_members")
    .select("profile_id")
    .eq("project_id", req.project_id)
    .eq("role", "creator");
  const profileIds = [...new Set([req.created_by, ...(acc ?? []).map((a: AgreementAcceptance) => a.profile_id), ...(creators ?? []).map((c: { profile_id: string }) => c.profile_id)])];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
  const nameOf = new Map((profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));

  const acceptances = ((acc ?? []) as AgreementAcceptance[])
    .filter((a) => a.agreement_version === AGREEMENT_VERSION)
    .map((a) => ({ ...a, name: nameOf.get(a.profile_id) ?? "Member" }));

  return {
    request: req,
    project: project as TeaserProject,
    tasks: (tasks ?? []) as TeaserItem[],
    requesterName: nameOf.get(req.created_by) ?? "Adopter",
    creatorNames: (creators ?? []).map((c: { profile_id: string }) => nameOf.get(c.profile_id) ?? "Creator"),
    acceptances,
    isCreator: isCreator === true,
    isTeam: isTeam === true,
    unlocked: unlocked === true,
    creatorAccepted: acceptances.some((a) => a.side === "creator"),
    adopterAccepted: acceptances.some((a) => a.side === "adopter"),
    mineAccepted: acceptances.some((a) => a.profile_id === userId),
  };
}
