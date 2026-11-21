"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/errors";
import type { TFn } from "@/lib/labels";

/** An owner appeals a moderation decision. One appeal per decision; the database enforces it. */
export async function appealDecision(decisionId: string, slug: string, body: string): Promise<{ error?: string }> {
  const errors = (await getTranslations("errors")) as unknown as TFn;
  await requireUser(`/proyek/${slug}/keputusan`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("appeal_decision", { p_decision: decisionId, p_body: body });
  if (error) return { error: dbErrorMessage(errors, error) };
  revalidatePath(`/proyek/${slug}/keputusan`);
  revalidatePath("/dasbor");
  return {};
}
