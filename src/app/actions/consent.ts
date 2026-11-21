"use server";

import { getTranslations } from "next-intl/server";
import { submitDecision } from "@/lib/db/consent";

export interface DecisionResult {
  ok: boolean;
  state: string;
  message: string;
}

const KNOWN = new Set(["approved", "declined", "withdrawn", "decided", "expired", "invalid", "rate_limited", "error"]);

/** Server action for the advisor page. No account: the secret token in the URL is the credential. */
export async function decideConsent(token: string, decision: "approved" | "declined" | "withdrawn", comment: string): Promise<DecisionResult> {
  const t = await getTranslations("advisor");
  const res = await submitDecision(token, decision, comment);
  const state = res.state === "not_found" ? "invalid" : res.state;
  return { ok: res.ok, state, message: t(`r.${KNOWN.has(state) ? state : "error"}`) };
}
