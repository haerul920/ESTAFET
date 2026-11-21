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
import { revokeAccess } from "@/app/actions/access";
import { AGREEMENT_DISCLAIMER, AGREEMENT_TERMS, AGREEMENT_VERSION } from "@/lib/agreement/terms";
import { formatDate } from "@/lib/labels";
import type { RequestStatus } from "@/lib/db/types";
import type { AccessHolder } from "@/lib/db/requests";

export interface ReviewProps {
  requestId: string;
  status: RequestStatus;
  isOwner: boolean;
  isTeam: boolean;
  /** Somebody from this request holds active access. */
  unlocked: boolean;
  /** The signed-in user already accepted the agreement for this request. */
  mineAccepted: boolean;
  /** The signed-in user's email is confirmed. Taking access needs it. */
  verified: boolean;
  holders: AccessHolder[];
  decisionNote: string | null;
  decidedAt: string | null;
  expiresAt: string | null;
  workspaceHref: string;
  creditLine: string;
}

export function DecisionCard({ requestId, status, isOwner, isTeam, decisionNote, decidedAt, expiresAt }: ReviewProps) {
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
          {status === "approved"
            ? "Approved"
            : status === "declined"
              ? "Declined"
              : status === "expired"
                ? "Expired without a decision"
                : "Withdrawn by the requesting team"}
          {decidedAt ? ` on ${formatDate(decidedAt)}` : ""}.
        </p>
        {decisionNote ? <p className="mb-0 mt-2 text-text-2">Message: &ldquo;{decisionNote}&rdquo;</p> : null}
        {status === "declined" ? <p className="mb-0 mt-2 text-sm text-text-2">The project stays published on ESTAFET.</p> : null}
        {status === "expired" ? <p className="mb-0 mt-2 text-sm text-text-2">The team can send a new request.</p> : null}
      </Card>
    );
  }

  if (!isOwner) {
    return (
      <Card as="section" className="flex flex-col gap-3">
        <h2 className="m-0 text-[22px]">Waiting for the owners</h2>
        <p className="m-0 text-text-2">
          The owners have your plan. You will get a notification when they decide.
          {expiresAt ? ` If nobody answers, the request expires on ${formatDate(expiresAt)}.` : ""}
        </p>
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
      <p className="m-0 text-sm text-text-2">
        Declining does not remove your project from ESTAFET. The team can apply again after a few days.
        {expiresAt ? ` Without an answer this request expires on ${formatDate(expiresAt)}.` : ""}
      </p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {info ? <FormMessage tone="success">{info}</FormMessage> : null}
    </Card>
  );
}

/** Per-person agreement. Each person who wants access accepts once, and that acceptance is their access. */
export function AgreementCard(p: ReviewProps) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [justAccepted, setJustAccepted] = useState(false);
  const canAccept = p.status === "approved" && p.isTeam && !p.isOwner && !p.mineAccepted;

  function accept() {
    start(async () => {
      setError("");
      const r = await acceptAgreement(p.requestId);
      if (r.error) setError(r.error);
      else {
        setJustAccepted(true);
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
        <h3 className="m-0 text-sm font-semibold">People with access</h3>
        {p.holders.length === 0 ? (
          <span className="text-sm text-text-2">Nobody has accepted yet. Each teammate accepts for themselves.</span>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {p.holders.map((h) => (
              <li key={h.accessId} className="flex flex-col gap-2 text-sm">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {h.name} · accepted {formatDate(h.acceptedAt)}
                  </span>
                  {h.status === "active" ? <Badge tone="ok">Has access</Badge> : <Badge tone="neutral">Access revoked</Badge>}
                </span>
                {p.isOwner && h.status === "active" ? <RevokeControl accessId={h.accessId} requestId={p.requestId} name={h.name} /> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canAccept ? (
        <div className="flex flex-col gap-3">
          {!p.verified ? (
            <FormMessage tone="error">Verify your email address first. Taking access needs a confirmed email.</FormMessage>
          ) : null}
          <CheckboxField
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            label="I accept these terms for myself, and I will credit the original team."
          />
          <Button size="md" disabled={!accepted || pending || !p.verified} onClick={accept} className="self-start">
            {pending ? "Saving…" : "Accept and get access"}
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
              <PartyPopper size={18} aria-hidden="true" />
              {justAccepted ? "Accepted. Your access is active." : p.isOwner ? "A team holds access to the private files." : "Access to the private files is active."}
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

/** Owners take access away with a written reason. The holder is told the reason. */
function RevokeControl({ accessId, requestId, name }: { accessId: string; requestId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <Button variant="outline" size="md" className="self-start" onClick={() => setOpen(true)}>
        Revoke access
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-[14px] bg-white p-3">
      <label htmlFor={`revoke-${accessId}`} className="text-sm font-semibold">
        Why are you revoking access for {name}? They will read this.
      </label>
      <textarea
        id={`revoke-${accessId}`}
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full resize-y rounded-[14px] border border-line-strong bg-white px-3.5 py-3 text-base"
      />
      <span className="text-[13px] text-text-2">At least 15 characters. They keep the duty to credit the original team.</span>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          size="md"
          disabled={pending || reason.trim().length < 15}
          onClick={() =>
            start(async () => {
              setError("");
              const r = await revokeAccess(accessId, reason.trim(), requestId);
              if (r.error) setError(r.error);
              else router.refresh();
            })
          }
        >
          Revoke access
        </Button>
        <Button variant="outline" size="md" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
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
