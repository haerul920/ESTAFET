"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AGREEMENT_VERSION } from "@/lib/agreement/terms";

/**
 * Open mode: accept the attribution agreement and get access, no approval needed.
 * The database checks everything (verified email, mode, quota, own project); this only passes the version the person saw.
 */
export async function takeAccess(projectId: string, slug: string): Promise<{ error?: string }> {
  await requireUser(`/projects/${slug}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("take_access", { p_project_id: projectId, p_agreement_version: AGREEMENT_VERSION });
  if (error) return { error: error.message };
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/dasbor");
  redirect(`/projects/${slug}/workspace`);
}

/** An owner takes someone's access away, with a written reason. The holder is notified. */
export async function revokeAccess(accessId: string, reason: string, requestId?: string): Promise<{ error?: string }> {
  await requireUser(requestId ? `/requests/${requestId}` : "/dasbor");
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_access", { p_access: accessId, p_reason: reason });
  if (error) return { error: error.message };
  if (requestId) revalidatePath(`/requests/${requestId}`);
  revalidatePath("/dasbor");
  return {};
}
