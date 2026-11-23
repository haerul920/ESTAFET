"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Download, FolderOpen, PartyPopper } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CheckboxField, FormMessage } from "@/components/ui/Field";
import { acceptAgreement, askQuestion, decideRequest, withdrawRequest } from "@/app/actions/requests";
import { revokeAccess } from "@/app/actions/access";
import { AGREEMENT_TERM_KEYS, AGREEMENT_VERSION } from "@/lib/agreement/terms";
import { formatDate } from "@/lib/format";
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
  const t = useTranslations("review");
  const locale = useLocale();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [pending, start] = useTransition();
  // Which button started the running action, so only that one shows the spinner.
  const [busy, setBusy] = useState<"approve" | "ask" | "decline" | "withdraw" | null>(null);

  // setBusy runs outside the transition: inside it, the update would wait until the action is done.
  const run = (which: NonNullable<typeof busy>, fn: () => Promise<{ error?: string }>, ok?: string) => {
    setBusy(which);
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
  };

  if (status !== "pending") {
    const state =
      status === "approved"
        ? t("stateApproved")
        : status === "declined"
          ? t("stateDeclined")
          : status === "expired"
            ? t("stateExpired")
            : t("stateWithdrawn");
    return (
      <Card as="section">
        <h2 className="mb-2 mt-0 text-[22px]">{t("decisionTitle")}</h2>
        <p className="m-0">
          {decidedAt ? t("stateOn", { state, date: formatDate(decidedAt, locale) }) : t("stateNoDate", { state })}
        </p>
        {decisionNote ? <p className="mb-0 mt-2 text-text-2">{t("decisionMessage", { note: decisionNote })}</p> : null}
        {status === "declined" ? <p className="mb-0 mt-2 text-sm text-text-2">{t("declinedNote")}</p> : null}
        {status === "expired" ? <p className="mb-0 mt-2 text-sm text-text-2">{t("expiredNote")}</p> : null}
      </Card>
    );
  }

  if (!isOwner) {
    return (
      <Card as="section" className="flex flex-col gap-3">
        <h2 className="m-0 text-[22px]">{t("waitingTitle")}</h2>
        <p className="m-0 text-text-2">
          {t("waitingText")}
          {expiresAt ? t("expiresIfNone", { date: formatDate(expiresAt, locale) }) : ""}
        </p>
        {isTeam ? (
          <>
            {confirmDecline ? (
              <div className="flex flex-wrap items-center gap-3">
                <span>{t("withdrawAsk")}</span>
                <Button
                  variant="danger"
                  size="md"
                  pending={pending && busy === "withdraw"}
                  disabled={pending}
                  onClick={() => run("withdraw", () => withdrawRequest(requestId))}
                >
                  {t("withdrawYes")}
                </Button>
                <Button variant="outline" size="md" onClick={() => setConfirmDecline(false)}>
                  {t("keep")}
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="md" className="self-start" onClick={() => setConfirmDecline(true)}>
                {t("withdraw")}
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
      <h2 className="m-0 text-[22px]">{t("yourDecision")}</h2>
      <div role="group" aria-label={t("tplLabel")} className="flex flex-wrap gap-2">
        {(
          [
            ["tplApproveShort", "tplApprove"],
            ["tplScopeShort", "tplScope"],
            ["tplBusyShort", "tplBusy"],
            ["tplAskShort", "tplAsk"],
          ] as const
        ).map(([label, text]) => (
          <button
            key={label}
            type="button"
            onClick={() => setMessage(t(text))}
            className="chip-hover min-h-[44px] cursor-pointer rounded-full border-[1.5px] border-line bg-white px-4 text-sm font-semibold hover:bg-surface"
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="msg" className="text-sm font-semibold">
          {t("msgLabel")}
        </label>
        <textarea
          id="msg"
          rows={3}
          value={message}
          maxLength={500}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("msgPh")}
          className="w-full resize-y rounded-[14px] border border-line-strong bg-white px-3.5 py-3 text-base"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          size="md"
          pending={pending && busy === "approve"}
          disabled={pending}
          onClick={() => run("approve", () => decideRequest(requestId, "approved", message))}
        >
          {t("approve")}
        </Button>
        <Button
          variant="outline"
          size="md"
          pending={pending && busy === "ask"}
          disabled={pending}
          onClick={() => {
            if (!message.trim()) {
              setError(t("questionFirst"));
              return;
            }
            run("ask", () => askQuestion(requestId, message), t("questionSent"));
          }}
        >
          {t("ask")}
        </Button>
        {confirmDecline ? (
          <span className="flex flex-wrap items-center gap-2">
            <Button
              variant="danger"
              size="md"
              pending={pending && busy === "decline"}
              disabled={pending}
              onClick={() => run("decline", () => decideRequest(requestId, "declined", message))}
            >
              {t("declineYes")}
            </Button>
            <Button variant="outline" size="md" onClick={() => setConfirmDecline(false)}>
              {t("cancel")}
            </Button>
          </span>
        ) : (
          <Button variant="danger" size="md" disabled={pending} onClick={() => setConfirmDecline(true)}>
            {t("decline")}
          </Button>
        )}
      </div>
      <p className="m-0 text-sm text-text-2">
        {t("declineNote")}
        {expiresAt ? t("expiresNote", { date: formatDate(expiresAt, locale) }) : ""}
      </p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {info ? <FormMessage tone="success">{info}</FormMessage> : null}
    </Card>
  );
}

/** Per-person agreement. Each person who wants access accepts once, and that acceptance is their access. */
export function AgreementCard(p: ReviewProps) {
  const t = useTranslations("review");
  const ag = useTranslations("agreement");
  const locale = useLocale();
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
        <h2 className="mb-1 mt-0 text-xl">{ag("title")}</h2>
        <span className="text-[13px] text-text-2">
          {p.status === "approved"
            ? ag("version", { version: AGREEMENT_VERSION })
            : ag("opensAfter", { version: AGREEMENT_VERSION })}
        </span>
      </div>
      <ul className="m-0 flex flex-col gap-2 pl-5 text-[15px]">
        {AGREEMENT_TERM_KEYS.map((k) => (
          <li key={k}>{ag(k)}</li>
        ))}
      </ul>

      <div className="flex flex-col gap-2.5">
        <h3 className="m-0 text-sm font-semibold">{t("peopleWithAccess")}</h3>
        {p.holders.length === 0 ? (
          <span className="text-sm text-text-2">{t("nobody")}</span>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {p.holders.map((h) => (
              <li key={h.accessId} className="flex flex-col gap-2 text-sm">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>{t("acceptedOn", { name: h.name, date: formatDate(h.acceptedAt, locale) })}</span>
                  {h.status === "active" ? (
                    <Badge tone="ok">{t("hasAccess")}</Badge>
                  ) : (
                    <Badge tone="neutral">{t("accessRevoked")}</Badge>
                  )}
                </span>
                {p.isOwner && h.status === "active" ? (
                  <RevokeControl accessId={h.accessId} requestId={p.requestId} name={h.name} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canAccept ? (
        <div className="flex flex-col gap-3">
          {!p.verified ? <FormMessage tone="error">{t("verifyFirst")}</FormMessage> : null}
          <CheckboxField checked={accepted} onChange={(e) => setAccepted(e.target.checked)} label={t("acceptLabel")} />
          <Button
            size="md"
            disabled={!accepted || pending || !p.verified}
            pending={pending}
            onClick={accept}
            className="self-start"
          >
            {pending ? t("saving") : t("acceptBtn")}
          </Button>
        </div>
      ) : p.mineAccepted ? (
        <p className="m-0 flex items-center gap-2 text-sm font-semibold text-ok">
          <Check size={16} aria-hidden="true" /> {t("youAccepted", { version: AGREEMENT_VERSION })}
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
              {justAccepted ? t("justAccepted") : p.isOwner ? t("ownerHolds") : t("holderActive")}
            </span>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={p.workspaceHref} size="md">
                <FolderOpen size={18} aria-hidden="true" /> {t("openWorkspace")}
              </ButtonLink>
              <ButtonLink
                href={`/api/requests/${p.requestId}/agreement?lang=${locale}`}
                variant="outline"
                size="md"
                download
              >
                <Download size={18} aria-hidden="true" /> {t("pdf")}
              </ButtonLink>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <p className="m-0 text-[13px] text-text-2">{ag("disclaimer")}</p>
    </Card>
  );
}

/** Owners take access away with a written reason. The holder is told the reason. */
function RevokeControl({ accessId, requestId, name }: { accessId: string; requestId: string; name: string }) {
  const t = useTranslations("review");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <Button variant="outline" size="md" className="self-start" onClick={() => setOpen(true)}>
        {t("revoke")}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-[14px] bg-white p-3">
      <label htmlFor={`revoke-${accessId}`} className="text-sm font-semibold">
        {t("revokeWhy", { name })}
      </label>
      <textarea
        id={`revoke-${accessId}`}
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full resize-y rounded-[14px] border border-line-strong bg-white px-3.5 py-3 text-base"
      />
      <span className="text-[13px] text-text-2">{t("revokeMin")}</span>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          size="md"
          disabled={pending || reason.trim().length < 15}
          pending={pending}
          onClick={() =>
            start(async () => {
              setError("");
              const r = await revokeAccess(accessId, reason.trim(), requestId);
              if (r.error) setError(r.error);
              else router.refresh();
            })
          }
        >
          {t("revoke")}
        </Button>
        <Button variant="outline" size="md" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}

export function CreditLineCard({ creditLine }: { creditLine: string }) {
  const t = useTranslations("review");
  const [copied, setCopied] = useState(false);
  return (
    <Card as="section" className="flex flex-col gap-3">
      <h2 className="m-0 text-base">{t("creditTitle")}</h2>
      <div className="rounded-[14px] border border-line-soft bg-white p-3.5 font-code text-[13px] leading-[1.6] text-text-3">
        {creditLine}
      </div>
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
        {copied ? t("copied") : t("copyCredit")}
      </Button>
    </Card>
  );
}
