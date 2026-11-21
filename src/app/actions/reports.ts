"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/validation";

const schema = z.object({
  project_id: z.string().uuid(),
  reason: z.enum(["copyright", "personal_data", "inaccurate", "inappropriate", "other"], { message: "Choose a reason." }),
  details: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(1000, "Keep the details under 1000 characters."),
  contact: z.string().trim().max(200, "Keep the contact under 200 characters.").optional(),
});

/** Public report. No account needed. Rate limited per client address (hashed). */
export async function submitReport(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  const ipHash = createHash("sha256").update(ip + "report").digest("hex").slice(0, 24);
  const admin = createAdminClient();

  const { data: allowed } = await admin.rpc("check_rate_limit", { p_key: `report:${ipHash}`, p_max: 5, p_window_seconds: 3600 });
  if (allowed !== true) return { error: "You sent several reports recently. Please wait a while before sending another.", values };

  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("id", parsed.data.project_id)
    .eq("status", "published")
    .eq("moderation_status", "ok")
    .maybeSingle();
  if (!project) return { error: "This project is not available to report.", values };

  const user = await getCurrentUser();
  const { error } = await admin.from("reports").insert({
    project_id: parsed.data.project_id,
    reporter_id: user?.id ?? null,
    reporter_contact: parsed.data.contact || null,
    reason: parsed.data.reason,
    details: parsed.data.details,
  });
  if (error) return { error: "Your report could not be sent. Please try again.", values };
  return { ok: true, message: "Thank you. Your report was sent to the ESTAFET team." };
}
