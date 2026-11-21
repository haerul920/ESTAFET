import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProjectAccess } from "@/lib/db/types";

/** Relationship checks. They ask the database, never the UI, and never depend on an account type. */

/** True when the signed-in user may read a project's private material: an owner, or someone holding active access. */
export async function canReadPrivate(projectId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_read_private", { pid: projectId });
  if (error) return false;
  return data === true;
}

/** True when the signed-in user is an active owner or co-owner of the project. */
export async function isProjectOwner(projectId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_project_owner", { pid: projectId });
  if (error) return false;
  return data === true;
}

/** The signed-in user's access row for a project (active or revoked), if any. */
export async function getMyAccess(projectId: string, userId: string): Promise<ProjectAccess | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_access")
    .select("*")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ProjectAccess | null) ?? null;
}

/** Whether the signed-in user has accepted the current Terms and Privacy Policy. */
export async function hasAcceptedPolicies(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("i_accepted_current_policies");
  if (error) return false;
  return data === true;
}
