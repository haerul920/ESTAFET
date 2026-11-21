"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/validation";
import type { TFn } from "@/lib/labels";

const REPORT_REASONS = [
  "copyright",
  "personal_data",
  "false_information",
  "inappropriate",
  "false_ownership",
  "harmful_file",
  "spam",
  "other",
] as const;

/** Public report. No account needed. Rate limited per client address (hashed); the database records it with a reference code. */
export async function submitReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const [v, a] = (await Promise.all([getTranslations("validation"), getTranslations("report")])) as unknown as [
    TFn,
    TFn,
  ];
  const schema = z.object({
    project_id: z.string().uuid(),
    reason: z.enum(REPORT_REASONS, { message: v("reportReason") }),
    details: z.string().trim().min(10, v("reportDetailsMin")).max(1000, v("reportDetailsMax")),
    evidence: z.string().trim().max(500).optional(),
    contact: z.string().trim().max(200, v("reportContactMax")).optional(),
  });
  const values = formValues(formData);
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  const ipHash = createHash("sha256")
    .update(ip + "report")
    .digest("hex")
    .slice(0, 24);
  const admin = createAdminClient();

  const { data: allowed } = await admin.rpc("check_rate_limit", {
    p_key: `report:${ipHash}`,
    p_max: 5,
    p_window_seconds: 3600,
  });
  if (allowed !== true) return { error: a("rateLimited"), values };

  const user = await getCurrentUser();
  // The database decides everything else (project available, link shape, own project, duplicates, automatic hold).
  const { data, error } = await admin.rpc("submit_report", {
    p_project: parsed.data.project_id,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details,
    p_evidence: parsed.data.evidence ?? "",
    p_contact: parsed.data.contact ?? "",
    p_reporter: user?.id ?? null,
    p_ip_hash: ipHash,
  });
  if (error) {
    const hint = (error as { hint?: string | null }).hint;
    if (hint === "not_available") return { error: a("notAvailable"), values };
    if (hint === "bad_link") return { fieldErrors: { evidence: a("badLink") }, values };
    if (hint === "own_project") return { error: a("ownProject"), values };
    if (hint === "details_short") return { fieldErrors: { details: v("reportDetailsMin") }, values };
    if (hint === "details_long") return { fieldErrors: { details: v("reportDetailsMax") }, values };
    return { error: a("sendFailed"), values };
  }
  const result = data as { reference: string; duplicate: boolean };
  return { ok: true, message: a(result.duplicate ? "duplicate" : "sentRef", { reference: result.reference }) };
}
