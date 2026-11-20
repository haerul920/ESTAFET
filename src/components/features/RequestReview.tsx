"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Download, FolderOpen, PartyPopper } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CheckboxField, FormMessage } from "@/components/ui/Field";
import { acceptAgreement, askQuestion, decideRequest, withdrawRequest } from "@/app/actions/requests";
import { AGREEMENT_DISCLAIMER, AGREEMENT_TERMS, AGREEMENT_VERSION } from "@/lib/agreement/terms";
import { formatDate } from "@/lib/labels";
import type { RequestStatus } from "@/lib/db/types";

export interface ReviewProps {
  requestId: string;
  status: RequestStatus;
  isCreator: boolean;
  isTeam: boolean;
  unlocked: boolean;
  creatorAccepted: boolean;
  adopterAccepted: boolean;
  mineAccepted: boolean;
  creatorAcceptedBy: string[];
  adopterAcceptedBy: string[];
  decisionNote: string | null;
  decidedAt: string | null;
  workspaceHref: string;
  creditLine: string;
}

export function DecisionCard({ requestId, status, isCreator, isTeam, decisionNote, decidedAt }: ReviewProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ error?: string }>, ok?: string) =>
    start(async () => {
      setError("");
      setInfo("");
      const r = await fn();
      if (r.error) setError(r.error);
      else {
        if (ok) setInfo(ok);
        router.refresh();
      }
    });

  if (status !== "pending") {
    return (
      <Card as="section">
        <h2 className="mb-2 mt-0 text-[22px]">Decision</h2>
        <p className="m-0">
          {status === "approved" ? "Approved" : status === "declined" ? "Declined" : "Withdrawn by the requesting team"}
          {decidedAt ? ` on ${formatDate(decidedAt)}` : ""}.
        </p>
        {decisionNote ? <p className="mb-0 mt-2 text-text-2">Message: &ldquo;{decisionNote}&rdquo;</p> : null}
        {status === "declined" ? <p className="mb-0 mt-2 text-sm text-text-2">The project stays published on ESTAFET.</p> : null}
      </Card>
    );
  }

  if (!isCreator) {
    return (
      <Card as="section" className="flex flex-col gap-3">
        <h2 className="m-0 text-[22px]">Waiting for the creators</h2>
        <p className="m-0 text-text-2">The original team has your plan. You will get a notification when they decide.</p>
        {isTeam ? (
          <>
            {confirmDecline ? (
              <div className="flex flex-wrap items-center gap-3">
                <span>Withdraw this request?</span>
                <Button variant="danger" size="md" disabled={pending} onClick={() => run(() => withdrawRequest(requestId))}>
                  Yes, withdraw
                </Button>
                <Button variant="outline" size="md" onClick={() => setConfirmDecline(false)}>
                  Keep it
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="md" className="self-start" onClick={() => setConfirmDecline(true)}>
                Withdraw request
              </Button>
            )}
          </>
        ) : null}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      </Card>
    );
  }

  return (
    <Card as="section" className="flex flex-col gap-4">
      <h2 className="m-0 text-[22px]">Your decision</h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="msg" className="text-sm font-semibold">
          Message to the team (optional)
        </label>
        <textarea
          id="msg"
          rows={3}
          value={message}
          maxLength={1000}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Share advice, or ask a question."
          className="w-full resize-y rounded-[14px] border border-line-strong bg-white px-3.5 py-3 text-base"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button size="md" disabled={pending} onClick={() => run(() => decideRequest(requestId, "approved", message))}>
          Approve request
        </Button>
        <Button
          variant="outline"
          size="md"
          disabled={pending}
          onClick={() => {
            if (!message.trim()) {
              setError("Write your question in the message box first.");
              return;
            }
            run(() => askQuestion(requestId, message), "Your question was sent. The request stays open.");
          }}
        >
          Ask a question
        </Button>
        {confirmDecline ? (
          <span className="flex flex-wrap items-center gap-2">
            <Button variant="danger" size="md" disabled={pending} onClick={() => run(() => decideRequest(requestId, "declined", message))}>
              Yes, decline
            </Button>
            <Button variant="outline" size="md" onClick={() => setConfirmDecline(false)}>
              Cancel
            </Button>
          </span>
        ) : (
          <Button variant="danger" size="md" disabled={pending} onClick={() => setConfirmDecline(true)}>
            Decline
          </Button>
        )}
      </div>
      <p className="m-0 text-sm text-text-2">Declining does not remove your project from ESTAFET.</p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {info ? <FormMessage tone="success">{info}</FormMessage> : null}
    </Card>
  );
}

export function AgreementCard(p: ReviewProps) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [justUnlocked, setJustUnlocked] = useState(false);
  const canAccept = p.status === "approved" && (p.isCreator || p.isTeam) && !p.mineAccepted;
  const mySide = p.isCreator ? "creator" : "adopter";

  function accept() {
    start(async () => {
      setError("");
      const r = await acceptAgreement(p.requestId);
      if (r.error) setError(r.error);
      else {
        if (r.unlocked) setJustUnlocked(true);
        router.refresh();
      }
    });
  }

  return (
    <Card tone="lime" as="section" className="flex flex-col gap-4">
      <div>
        <h2 className="mb-1 mt-0 text-xl">Attribution agreement</h2>
        <span className="text-[13px] text-text-2">
          Version {AGREEMENT_VERSION}
          {p.status === "approved" ? "" : ", opens after the request is approved"}
        </span>
      </div>
      <ul className="m-0 flex flex-col gap-2 pl-5 text-[15px]">
        {AGREEMENT_TERMS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <div className="flex flex-col gap-2.5">
        <SideRow label="Creators" accepted={p.creatorAccepted} by={p.creatorAcceptedBy} />
        <SideRow label="Adopter team" accepted={p.adopterAccepted} by={p.adopterAcceptedBy} />
      </div>

      {canAccept ? (
        <div className="flex flex-col gap-3">
          <CheckboxField
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            label={p.isCreator ? "I accept these terms as a creator of this project." : "I accept these terms on behalf of the adopter team."}
          />
          <Button size="md" disabled={!accepted || pending} onClick={accept} className="self-start">
            {pending ? "Saving…" : `Accept as ${mySide === "creator" ? "creator" : "adopter"}`}
          </Button>
        </div>
      ) : p.mineAccepted ? (
        <p className="m-0 flex items-center gap-2 text-sm font-semibold text-ok">
          <Check size={16} aria-hidden="true" /> You accepted version {AGREEMENT_VERSION}.
        </p>
      ) : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <AnimatePresence>
        {p.unlocked ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="flex flex-col gap-3 rounded-[18px] bg-ok-bg p-4 text-ok"
          >
            <span className="flex items-center gap-2 font-semibold">
              <PartyPopper size={18} aria-hidden="true" /> {justUnlocked ? "Both sides accepted. Files are unlocked." : "Files are unlocked for the adopter team."}
            </span>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={p.workspaceHref} size="md">
                <FolderOpen size={18} aria-hidden="true" /> Open workspace
              </ButtonLink>
              <ButtonLink href={`/api/requests/${p.requestId}/agreement`} variant="outline" size="md" download>
                <Download size={18} aria-hidden="true" /> Agreement PDF
              </ButtonLink>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <p className="m-0 text-[13px] text-text-2">{AGREEMENT_DISCLAIMER}</p>
    </Card>
  );
}

function SideRow({ label, accepted, by }: { label: string; accepted: boolean; by: string[] }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={String(accepted)} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
          {accepted ? <Badge tone="ok">Accepted{by.length ? ` by ${by.join(", ")}` : ""}</Badge> : <Badge tone="neutral">Waiting to accept</Badge>}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export function CreditLineCard({ creditLine }: { creditLine: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card as="section" className="flex flex-col gap-3">
      <h2 className="m-0 text-base">Credit line for future submissions</h2>
      <div className="rounded-[14px] border border-line-soft bg-white p-3.5 font-code text-[13px] leading-[1.6] text-text-3">{creditLine}</div>
      <Button
        variant="outlineBlue"
        size="md"
        className="self-start"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(creditLine);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        {copied ? "Copied" : "Copy credit line"}
      </Button>
    </Card>
  );
}
