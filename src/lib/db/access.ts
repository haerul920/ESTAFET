import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Asks the database (not the UI) whether the signed-in user may read a project's private material. */
export async function canReadPrivate(projectId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_read_private", { pid: projectId });
  if (error) return false;
  return data === true;
}

export async function isProjectCreator(projectId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_project_creator", { pid: projectId });
  if (error) return false;
  return data === true;
}
