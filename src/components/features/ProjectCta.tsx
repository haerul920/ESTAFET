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
import { AGREEMENT_TERM_KEYS, AGREEMENT_VERSION } from "@/lib/agreement/terms";
import type { AccessMode } from "@/lib/db/types";

/** What this visitor can do with the project right now. Decided on the server from relationships, never from an account type. */
export type CtaState =
  | { kind: "guest"; mode: AccessMode; quotaFull: boolean }
  | { kind: "owner"; slug?: string }
  | { kind: "holder" }
  | { kind: "revoked" }
  | { kind: "request"; requestId: string; status: "pending" | "approved" }
  | { kind: "paused"; watching: boolean }
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
    case "paused":
      return (
        <Card tone="lime" className="flex flex-col gap-2">
          <h2 className="m-0 text-xl">{t("pausedTitle")}</h2>
          <p className="m-0 text-[15px] text-text-2">{t("pausedText")}</p>
          <WatchButton projectId={projectId} slug={slug} watching={state.watching} />
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
          {state.mode === "paused" || state.quotaFull ? (
            <>
              <p className="m-0 text-[15px] text-text-2">
                {state.mode === "paused" ? t("guestPaused") : t("guestFull")}
              </p>
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
  const ag = useTranslations("agreement");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card tone="lime" className="flex flex-col gap-3">
      <h2 className="m-0 text-xl">{t("openTitle")}</h2>
      <p className="m-0 text-[15px] text-text-2">{t("openText")}</p>
      {!verified ? <VerifyEmailNotice email={email} compact /> : null}
      <details className="rounded-[14px] bg-white/70 p-3 text-[14px]">
        <summary className="cursor-pointer font-semibold">{t("readAgreement", { version: AGREEMENT_VERSION })}</summary>
        <ul className="mb-2 mt-2 flex flex-col gap-1.5 pl-5">
          {AGREEMENT_TERM_KEYS.map((k) => (
            <li key={k}>{ag(k)}</li>
          ))}
        </ul>
        <p className="m-0 text-[12.5px] text-text-2">{ag("disclaimer")}</p>
      </details>
      <CheckboxField
        checked={accepted}
        onChange={(e) => setAccepted(e.target.checked)}
        disabled={!verified}
        label={t("accept")}
      />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button
        className="justify-center"
        disabled={!accepted || pending || !verified}
        pending={pending}
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
        pending={pending}
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
