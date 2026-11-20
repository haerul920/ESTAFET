import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, isExpired, looksLikeToken } from "@/lib/token";

export type ConsentState =
  | { state: "invalid" }
  | { state: "rate_limited" }
  | {
      state: "expired" | "pending" | "approved" | "declined" | "withdrawn";
      project: { title: string; summary: string; is_demo: boolean; sharedBy: string; advisorName: string };
      decidedAt: string | null;
    };

async function clientKey(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

/** Rate limits the endpoint per client address and per token (DB-backed, survives restarts). */
export async function allowConsentRequest(tokenHash: string, max = 30): Promise<boolean> {
  const admin = createAdminClient();
  const ip = await clientKey();
  const { data } = await admin.rpc("check_rate_limit", { p_key: `consent:${ip}:${tokenHash.slice(0, 12)}`, p_max: max, p_window_seconds: 600 });
  return data === true;
}

/** Looks a token up with the service role. Only the hash is ever compared or stored. */
export async function loadConsent(token: string): Promise<ConsentState> {
  if (!looksLikeToken(token)) return { state: "invalid" };
  const hash = hashToken(token);
  if (!(await allowConsentRequest(hash))) return { state: "rate_limited" };

  const admin = createAdminClient();
  const { data: consent } = await admin
    .from("advisor_consents")
    .select("status, expires_at, decided_at, project_id")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!consent) return { state: "invalid" };

  const { data: project } = await admin
    .from("projects")
    .select("title, summary, is_demo, advisor_name, created_by")
    .eq("id", consent.project_id)
    .single();
  if (!project) return { state: "invalid" };
  const { data: creator } = await admin.from("profiles").select("full_name").eq("id", project.created_by).maybeSingle();

  const info = {
    title: project.title,
    summary: project.summary,
    is_demo: project.is_demo,
    sharedBy: creator?.full_name ?? "A student",
    advisorName: project.advisor_name,
  };
  const state =
    consent.status === "pending" && isExpired(consent.expires_at) ? "expired" : (consent.status as "pending" | "approved" | "declined" | "withdrawn");
  return { state, project: info, decidedAt: consent.decided_at };
}

/** Applies the advisor's decision through the database function (service role only). */
export async function submitDecision(
  token: string,
  decision: "approved" | "declined" | "withdrawn",
  comment: string,
): Promise<{ ok: boolean; state: string }> {
  if (!looksLikeToken(token)) return { ok: false, state: "invalid" };
  const hash = hashToken(token);
  if (!(await allowConsentRequest(hash, 10))) return { ok: false, state: "rate_limited" };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("decide_advisor_consent", {
    p_token_hash: hash,
    p_decision: decision,
    p_comment: comment.slice(0, 1000),
  });
  if (error || !data) return { ok: false, state: "error" };
  return data as { ok: boolean; state: string };
}
