"use client";

import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { Check, Circle, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CopyLinkButton } from "./CopyLinkButton";
import type { PublishChecklist as Checklist } from "@/lib/db/owner";
import { cn } from "@/lib/cn";

function Mark({ state }: { state: "done" | "warn" | "todo" }) {
  const cls =
    state === "done" ? "bg-ok-bg text-ok" : state === "warn" ? "bg-warn-bg text-warn" : "bg-chip text-text-2";
  return (
    <motion.span
      key={state}
      initial={{ scale: 0.6 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
      aria-hidden="true"
      className={cn("flex h-6 w-6 flex-none items-center justify-center rounded-full font-semibold", cls)}
    >
      {state === "done" ? <Check size={14} strokeWidth={3} /> : state === "warn" ? <TriangleAlert size={13} /> : <Circle size={8} />}
    </motion.span>
  );
}

/** The right-rail "Before you can publish" card. Reflects the real database state. */
export function PublishChecklist({
  projectId,
  checklist,
  advisorEmail,
  step,
}: {
  projectId: string;
  checklist: Checklist;
  advisorEmail: string;
  step: string;
}) {
  const { team, advisor, review, policies } = checklist;
  const advisorText =
    advisor.status === "not_needed"
      ? "No advisor declared"
      : advisor.status === "approved"
        ? "Advisor approved"
        : advisor.status === "declined"
          ? "Advisor said not now"
          : advisor.status === "withdrawn"
            ? "Advisor approval withdrawn"
            : advisor.status === "pending"
              ? "Advisor approval pending"
              : "Advisor approval not requested";

  return (
    <Card as="aside" aria-label="Before you can publish">
      <h2 className="mb-4 mt-0 text-lg">Before you can publish</h2>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        <li className="flex gap-3">
          <Mark state={team.done ? "done" : "warn"} />
          <span>
            <strong>{team.done ? "Team agreed" : "Team agreement pending"}</strong>
            <br />
            <span className="text-sm text-text-2">
              {team.confirmed} of {team.total} members confirmed
            </span>
            {!team.done && step !== "consent" ? (
              <>
                <br />
                <Link href={`/share/${projectId}/consent`} className="text-sm font-semibold">
                  Go to Consent
                </Link>
              </>
            ) : null}
          </span>
        </li>
        <li className="flex gap-3">
          <Mark state={advisor.done ? "done" : "warn"} />
          <span>
            <strong>{advisorText}</strong>
            <br />
            <span className="text-sm text-text-2">
              {advisor.done
                ? "Publishing is unlocked on this side."
                : advisor.status === "pending"
                  ? `Share the private link with ${advisorEmail || "your advisor"}. Publishing stays locked until they approve. You can keep working meanwhile.`
                  : "Publishing stays locked until your advisor approves, or you declare that there is no advisor."}
            </span>
            {!advisor.done ? (
              <>
                <br />
                {step === "consent" ? null : <CopyLinkButton projectId={projectId} label="Copy consent link" />}
              </>
            ) : null}
          </span>
        </li>
        <li className="flex gap-3">
          <Mark state={review.done ? "done" : review.total > 0 ? "warn" : "todo"} />
          <span>
            <strong>Review the AI draft</strong>
            <br />
            <span className="text-sm text-text-2">
              {review.total === 0
                ? "Next step: upload files and draft items."
                : `${review.reviewed} of ${review.total} items reviewed`}
            </span>
          </span>
        </li>
        <li className="flex gap-3">
          <Mark state={policies.done ? "done" : "warn"} />
          <span>
            <strong>{policies.done ? "Terms and Privacy Policy accepted" : "Terms and Privacy Policy not accepted yet"}</strong>
            <br />
            <span className="text-sm text-text-2">{policies.done ? "You can publish once the other steps are done." : "You accept them on the last step, before publishing."}</span>
          </span>
        </li>
      </ul>
    </Card>
  );
}
