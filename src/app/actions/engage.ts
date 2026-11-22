"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/errors";
import type { TFn } from "@/lib/labels";

async function errs() {
  return (await getTranslations("errors")) as unknown as TFn;
}

type Result = { error?: string };

/** "Beri tahu saya": one notification when access opens again or a team slot frees up. */
export async function watchProject(projectId: string, slug: string, watch: boolean): Promise<Result> {
  const e = await errs();
  await requireUser(`/projects/${slug}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc(watch ? "watch_project" : "unwatch_project", { p_project_id: projectId });
  if (error) return { error: dbErrorMessage(e, error) };
  revalidatePath(`/projects/${slug}`);
  return {};
}

/** A short message in the thread between a requesting team and the owners (500 characters at most). */
export async function postRequestMessage(requestId: string, body: string): Promise<Result> {
  const e = await errs();
  await requireUser(`/requests/${requestId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_request_message", { p_request_id: requestId, p_body: body });
  if (error) return { error: dbErrorMessage(e, error) };
  revalidatePath(`/requests/${requestId}`);
  return {};
}

/** Access holders and owners mark a verified next task "in_progress" or "done", or clear it ("none"). */
export async function setItemProgress(
  itemId: string,
  status: "in_progress" | "done" | "none",
  slug: string,
): Promise<Result> {
  const e = await errs();
  await requireUser(`/projects/${slug}/workspace`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_item_progress", { p_item: itemId, p_status: status });
  if (error) return { error: dbErrorMessage(e, error) };
  revalidatePath(`/projects/${slug}/workspace`);
  return {};
}
