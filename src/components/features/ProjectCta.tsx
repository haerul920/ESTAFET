"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CheckboxField, FormMessage } from "@/components/ui/Field";
import { VerifyEmailNotice } from "@/components/features/VerifyEmailNotice";
import { takeAccess } from "@/app/actions/access";
import { watchProject } from "@/app/actions/engage";
import { useRouter } from "@/i18n/navigation";
import { AGREEMENT_TERM_KEYS } from "@/lib/agreement/terms";
import type { AccessMode } from "@/lib/db/types";
import { Info, ScrollText } from "lucide-react";

/** What this visitor can do with the project right now. Decided on the server from relationships, never from an account type. */
export type CtaState =
  | { kind: "guest"; mode: AccessMode; quotaFull: boolean }
  | { kind: "owner"; slug?: string }
  | { kind: "holder" }
  | { kind: "revoked" }
  | { kind: "request"; requestId: string; status: "pending" | "approved" }
  | { kind: "quota_full"; watching: boolean }
  | { kind: "open"; verified: boolean; email: string }
  | { kind: "by_request"; verified: boolean; email: string };

export function ProjectCta({ state, projectId, slug }: { state: CtaState; projectId: string; slug: string }) {
  const t = useTranslations("cta");
  const workspace = `/projects/${slug}/workspace`;
  switch (state.kind) {
    case "owner":
      return (
        <Card tone="lime" className="flex flex-col gap-3">
          <h2 className="m-0 text-xl">{t("ownerTitle")}</h2>
          <p className="m-0 text-[15px] text-text-2">{t("ownerText")}</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/proyek/${slug}/pengaturan`} arrow>
              {t("openSettings")}
            </ButtonLink>
            <ButtonLink href="/dasbor" variant="outline">
              {t("openDashboard")}
            </ButtonLink>
          </div>
        </Card>
      );
    case "holder":
      return (
        <Card tone="lime" className="flex flex-col gap-3">
          <h2 className="m-0 text-xl">{t("holderTitle")}</h2>
          <p className="m-0 text-[15px] text-text-2">{t("holderText")}</p>
          <ButtonLink href={workspace} arrow>
            {t("openWorkspace")}
          </ButtonLink>
        </Card>
      );
    case "revoked":
      return (
        <Card tone="lime" className="flex flex-col gap-2">
          <h2 className="m-0 text-xl">{t("revokedTitle")}</h2>
          <p className="m-0 text-[15px] text-text-2">{t("revokedText")}</p>
        </Card>
      );
    case "request":
      return (
        <Card tone="lime" className="flex flex-col gap-3">
          <h2 className="m-0 text-xl">{state.status === "approved" ? t("approvedTitle") : t("pendingTitle")}</h2>
          <p className="m-0 text-[15px] text-text-2">
            {state.status === "approved" ? t("approvedText") : t("pendingText")}
          </p>
          <ButtonLink href={`/requests/${state.requestId}`}>
            {state.status === "approved" ? t("acceptAgreement") : t("viewRequest")}
          </ButtonLink>
        </Card>
      );
    case "quota_full":
      return (
        <Card tone="lime" className="flex flex-col gap-2">
          <h2 className="m-0 text-xl">{t("quotaTitle")}</h2>
          <p className="m-0 text-[15px] text-text-2">{t("quotaText")}</p>
          <WatchButton projectId={projectId} slug={slug} watching={state.watching} />
        </Card>
      );
    case "guest":
      return (
        <Card tone="lime" className="flex flex-col gap-3">
          <h2 className="m-0 text-xl">{t("guestTitle")}</h2>
          {state.quotaFull ? (
            <>
              <p className="m-0 text-[15px] text-text-2">{t("guestFull")}</p>
              <ButtonLink
                href={`/login?next=${encodeURIComponent(`/projects/${slug}`)}`}
                variant="outline"
                className="justify-center"
              >
                {t("signInToWatch")}
              </ButtonLink>
            </>
          ) : (
            <>
              <p className="m-0 text-[15px] text-text-2">
                {state.mode === "open" ? t("guestOpen") : t("guestRequest")}
              </p>
              <ButtonLink href={`/login?next=${encodeURIComponent(`/projects/${slug}`)}`} className="justify-center">
                {t("signInContinue")}
              </ButtonLink>
            </>
          )}
        </Card>
      );
    case "by_request":
      return (
        <Card tone="lime" className="flex flex-col gap-3">
          <h2 className="m-0 text-xl">{t("guestTitle")}</h2>
          <p className="m-0 text-[15px] text-text-2">{t("byRequestText")}</p>
          {!state.verified ? <VerifyEmailNotice email={state.email} compact /> : null}
          {state.verified ? (
            <ButtonLink href={`/projects/${slug}/request`} className="justify-center">
              {t("ask")}
            </ButtonLink>
          ) : null}
          <p className="m-0 text-[13px] text-text-2">{t("creditNote")}</p>
        </Card>
      );
    case "open":
      return <OpenAccessCard projectId={projectId} slug={slug} verified={state.verified} email={state.email} />;
  }
}

/** The whole Attribution Agreement, always in view: nobody should accept terms they had to open to see. */
function AgreementTerms() {
  const t = useTranslations("cta");
  const ag = useTranslations("agreement");
  return (
    <section aria-labelledby="agreement-h" className="overflow-hidden rounded-[20px] border border-line-soft bg-white">
      <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3.5">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-blue-tint text-blue"
        >
          <ScrollText size={20} />
        </span>
        <h3 id="agreement-h" className="m-0 text-[17px] font-semibold tracking-normal">
          {t("readAgreement")}
        </h3>
      </div>
      <ol className="m-0 flex list-none flex-col gap-3 p-4">
        {AGREEMENT_TERM_KEYS.map((k, index) => (
          <li key={k} className="flex items-start gap-3 text-[15px] leading-relaxed text-text-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-surface text-[13px] font-semibold text-ink"
            >
              {index + 1}
            </span>
            <span>{ag(k)}</span>
          </li>
        ))}
      </ol>
      <p className="m-0 flex items-start gap-2.5 border-t border-line-soft bg-surface px-4 py-3 text-[13px] text-text-2">
        <Info size={16} aria-hidden="true" className="mt-0.5 flex-none" />
        <span>{ag("disclaimer")}</span>
      </p>
    </section>
  );
}

/** Open mode: read the agreement, tick one box, and the files open. Owners are told, no approval needed. */
function OpenAccessCard({
  projectId,
  slug,
  verified,
  email,
}: {
  projectId: string;
  slug: string;
  verified: boolean;
  email: string;
}) {
  const t = useTranslations("cta");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card tone="lime" className="flex flex-col gap-3">
      <h2 className="m-0 text-xl">{t("openTitle")}</h2>
      <p className="m-0 text-[15px] text-text-2">{t("openText")}</p>
      {!verified ? <VerifyEmailNotice email={email} compact /> : null}
      <AgreementTerms />
      <CheckboxField
        checked={accepted}
        onChange={(e) => setAccepted(e.target.checked)}
        disabled={!verified}
        label={t("accept")}
      />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button
        className="justify-center"
        loading={pending}
        disabled={!accepted || pending || !verified}
        onClick={() =>
          start(async () => {
            setError("");
            const r = await takeAccess(projectId, slug);
            if (r?.error) setError(r.error);
          })
        }
      >
        {pending ? t("saving") : t("continue")}
      </Button>
    </Card>
  );
}

/** "Beri tahu saya": one notification when access opens again or a team slot frees up. */
function WatchButton({ projectId, slug, watching }: { projectId: string; slug: string; watching: boolean }) {
  const t = useTranslations("cta");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[13px] text-text-2">{watching ? t("watching") : t("watchHint")}</p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button
        variant={watching ? "outline" : "primary"}
        className="justify-center"
        loading={pending}
        disabled={pending}
        aria-pressed={watching}
        onClick={() =>
          start(async () => {
            setError("");
            const r = await watchProject(projectId, slug, !watching);
            if (r.error) setError(r.error);
            else router.refresh();
          })
        }
      >
        {watching ? t("unwatch") : t("watch")}
      </Button>
    </div>
  );
}
