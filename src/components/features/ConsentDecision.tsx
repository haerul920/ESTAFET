"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleSlash } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { decideConsent, type DecisionResult } from "@/app/actions/consent";

/** Advisor decision controls. Large touch targets, built for a phone. */
export function ConsentDecision({ token, canWithdraw }: { token: string; canWithdraw?: boolean }) {
  const [comment, setComment] = useState("");
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [pending, start] = useTransition();

  function decide(decision: "approved" | "declined" | "withdrawn") {
    start(async () => setResult(await decideConsent(token, decision, comment)));
  }

  return (
    <AnimatePresence mode="wait">
      {result?.ok ? (
        <motion.div
          key="done"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          role="status"
          className="flex flex-col items-center gap-3 rounded-3xl bg-ok-bg p-6 text-center text-ok"
        >
          {result.state === "approved" ? <CheckCircle2 size={44} aria-hidden="true" /> : <CircleSlash size={44} aria-hidden="true" />}
          <p className="m-0 text-base font-semibold">{result.message}</p>
          <p className="m-0 text-sm">You can close this page.</p>
        </motion.div>
      ) : (
        <motion.div key="form" className="flex flex-col gap-4" exit={{ opacity: 0 }}>
          {canWithdraw ? (
            <Button variant="danger" size="md" disabled={pending} onClick={() => decide("withdrawn")} className="min-h-[48px] justify-center">
              Withdraw my approval
            </Button>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="note" className="text-sm font-semibold">
                  Comment for the team (optional)
                </label>
                <textarea
                  id="note"
                  rows={3}
                  value={comment}
                  maxLength={1000}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full resize-y rounded-[14px] border border-line-strong bg-white px-3.5 py-3 text-base"
                />
              </div>
              <div className="flex flex-col gap-3">
                <Button size="md" disabled={pending} onClick={() => decide("approved")} className="min-h-[52px] justify-center text-base">
                  {pending ? "Saving…" : "Approve publishing"}
                </Button>
                <Button variant="outline" size="md" disabled={pending} onClick={() => decide("declined")} className="min-h-[52px] justify-center text-base">
                  Not now
                </Button>
              </div>
            </>
          )}
          {result && !result.ok ? <FormMessage tone="error">{result.message}</FormMessage> : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
