"use server";

import { submitDecision } from "@/lib/db/consent";

export interface DecisionResult {
  ok: boolean;
  state: string;
  message: string;
}

const MESSAGES: Record<string, string> = {
  approved: "Thank you. Your approval is recorded, and the students can now publish their teaser.",
  declined: "Understood. Nothing will be published, and the students are told you said not now.",
  withdrawn: "Your approval is withdrawn. The students can no longer publish until you approve again.",
  decided: "A decision was already recorded for this link, so nothing changed.",
  expired: "This link has expired. Ask the students to create a new one.",
  not_found: "This link is not valid.",
  invalid: "This link is not valid.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  error: "Something went wrong. Please try again in a moment.",
};

/** Server action for the advisor page. No account: the secret token in the URL is the credential. */
export async function decideConsent(token: string, decision: "approved" | "declined" | "withdrawn", comment: string): Promise<DecisionResult> {
  const res = await submitDecision(token, decision, comment);
  const state = res.ok ? res.state : res.state;
  return { ok: res.ok, state, message: MESSAGES[state] ?? MESSAGES.error };
}
