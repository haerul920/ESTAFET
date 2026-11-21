"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/validation";
import type { TFn } from "@/lib/labels";

/** Public report. No account needed. Rate limited per client address (hashed). */
export async function submitReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const [v, a] = (await Promise.all([getTranslations("validation"), getTranslations("report")])) as unknown as [TFn, TFn];
  const schema = z.object({
    project_id: z.string().uuid(),
    reason: z.enum(["copyright", "personal_data", "inaccurate", "inappropriate", "other"], { message: v("reportReason") }),
    details: z.string().trim().min(10, v("reportDetailsMin")).max(1000, v("reportDetailsMax")),
    contact: z.string().trim().max(200, v("reportContactMax")).optional(),
  });
  const values = formValues(formData);
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  const ipHash = createHash("sha256").update(ip + "report").digest("hex").slice(0, 24);
  const admin = createAdminClient();

  const { data: allowed } = await admin.rpc("check_rate_limit", { p_key: `report:${ipHash}`, p_max: 5, p_window_seconds: 3600 });
  if (allowed !== true) return { error: a("rateLimited"), values };

  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("id", parsed.data.project_id)
    .eq("status", "published")
    .eq("moderation_status", "ok")
    .maybeSingle();
  if (!project) return { error: a("notAvailable"), values };

  const user = await getCurrentUser();
  const { error } = await admin.from("reports").insert({
    project_id: parsed.data.project_id,
    reporter_id: user?.id ?? null,
    reporter_contact: parsed.data.contact || null,
    reason: parsed.data.reason,
    details: parsed.data.details,
  });
  if (error) return { error: a("sendFailed"), values };
  return { ok: true, message: a("sent") };
}
