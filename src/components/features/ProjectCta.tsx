"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CheckboxField, FormMessage } from "@/components/ui/Field";
import { VerifyEmailNotice } from "@/components/features/VerifyEmailNotice";
import { takeAccess } from "@/app/actions/access";
import { AGREEMENT_DISCLAIMER, AGREEMENT_TERMS, AGREEMENT_VERSION } from "@/lib/agreement/terms";
import type { AccessMode } from "@/lib/db/types";

/** What this visitor can do with the project right now. Decided on the server from relationships, never from an account type. */
export type CtaState =
  | { kind: "guest"; mode: AccessMode; quotaFull: boolean }
  | { kind: "owner" }
  | { kind: "holder" }
  | { kind: "revoked" }
  | { kind: "request"; requestId: string; status: "pending" | "approved" }
  | { kind: "paused" }
  | { kind: "quota_full" }
  | { kind: "open"; verified: boolean; email: string }
  | { kind: "by_request"; verified: boolean; email: string };

export function ProjectCta({ state, projectId, slug }: { state: CtaState; projectId: string; slug: string }) {
  const workspace = `/projects/${slug}/workspace`;
  switch (state.kind) {
    case "owner":
      return (
        <Card tone="lime" className="flex flex-col gap-3">
          <h2 className="m-0 text-xl">This is your project</h2>
          <p className="m-0 text-[15px] text-text-2">Requests and new access appear on your dashboard.</p>
          <ButtonLink href="/dasbor" variant="outline">
            Open dashboard
          </ButtonLink>
        </Card>
      );
    case "holder":
      return (
        <Card tone="lime" className="flex flex-col gap-3">
          <h2 className="m-0 text-xl">You have access</h2>
          <p className="m-0 text-[15px] text-text-2">Remember to credit the original team in anything that builds on this project.</p>
          <ButtonLink href={workspace} arrow>
            Open workspace
          </ButtonLink>
        </Card>
      );
    case "revoked":
      return (
        <Card tone="lime" className="flex flex-col gap-2">
          <h2 className="m-0 text-xl">Your access was revoked</h2>
          <p className="m-0 text-[15px] text-text-2">The owners ended your access and told you why. The duty to credit the original team still applies.</p>
        </Card>
      );
    case "request":
      return (
        <Card tone="lime" className="flex flex-col gap-3">
          <h2 className="m-0 text-xl">{state.status === "approved" ? "Your request was approved" : "Your request is with the owners"}</h2>
          <p className="m-0 text-[15px] text-text-2">
            {state.status === "approved" ? "Accept the attribution agreement to get access to the files." : "You will be notified when they decide."}
          </p>
          <ButtonLink href={`/requests/${state.requestId}`}>{state.status === "approved" ? "Accept the agreement" : "View your request"}</ButtonLink>
        </Card>
      );
    case "paused":
      return (
        <Card tone="lime" className="flex flex-col gap-2">
          <h2 className="m-0 text-xl">New access is paused</h2>
          <p className="m-0 text-[15px] text-text-2">The owners paused new requests for now. You can still read this teaser, and teams that already have access keep it.</p>
        </Card>
      );
    case "quota_full":
      return (
        <Card tone="lime" className="flex flex-col gap-2">
          <h2 className="m-0 text-xl">Team quota is full</h2>
          <p className="m-0 text-[15px] text-text-2">The owners set a limit on how many teams can continue this project at once, and it is reached. You can still read this teaser.</p>
        </Card>
      );
    case "guest":
      return (
        <Card tone="lime" className="flex flex-col gap-3">
          <h2 className="m-0 text-xl">Want to continue this project?</h2>
          {state.mode === "paused" ? (
            <p className="m-0 text-[15px] text-text-2">The owners paused new access for now.</p>
          ) : state.quotaFull ? (
            <p className="m-0 text-[15px] text-text-2">The team quota for this project is full.</p>
          ) : (
            <>
              <p className="m-0 text-[15px] text-text-2">
                {state.mode === "open"
                  ? "Sign in, accept the attribution agreement, and the files open right away."
                  : "Sign in and send a short plan. It takes about 5 minutes. The owners reply through ESTAFET."}
              </p>
              <ButtonLink href={`/login?next=${encodeURIComponent(`/projects/${slug}`)}`} className="justify-center">
                Sign in to continue
              </ButtonLink>
            </>
          )}
        </Card>
      );
    case "by_request":
      return (
        <Card tone="lime" className="flex flex-col gap-3">
          <h2 className="m-0 text-xl">Want to continue this project?</h2>
          <p className="m-0 text-[15px] text-text-2">Send a short plan. It takes about 5 minutes. The owners reply through ESTAFET.</p>
          {!state.verified ? <VerifyEmailNotice email={state.email} compact /> : null}
          {state.verified ? (
            <ButtonLink href={`/projects/${slug}/request`} className="justify-center">
              Ask to continue
            </ButtonLink>
          ) : null}
          <p className="m-0 text-[13px] text-text-2">Continuing means crediting the original team in your future submissions.</p>
        </Card>
      );
    case "open":
      return <OpenAccessCard projectId={projectId} slug={slug} verified={state.verified} email={state.email} />;
  }
}

/** Open mode: read the agreement, tick one box, and the files open. Owners are told, no approval needed. */
function OpenAccessCard({ projectId, slug, verified, email }: { projectId: string; slug: string; verified: boolean; email: string }) {
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card tone="lime" className="flex flex-col gap-3">
      <h2 className="m-0 text-xl">Continue this project</h2>
      <p className="m-0 text-[15px] text-text-2">
        This project opens right away with an attribution agreement. No approval is needed, and the owners are told when you take access.
      </p>
      {!verified ? <VerifyEmailNotice email={email} compact /> : null}
      <details className="rounded-[14px] bg-white/70 p-3 text-[14px]">
        <summary className="cursor-pointer font-semibold">Read the agreement (version {AGREEMENT_VERSION})</summary>
        <ul className="mb-2 mt-2 flex flex-col gap-1.5 pl-5">
          {AGREEMENT_TERMS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="m-0 text-[12.5px] text-text-2">{AGREEMENT_DISCLAIMER}</p>
      </details>
      <CheckboxField
        checked={accepted}
        onChange={(e) => setAccepted(e.target.checked)}
        disabled={!verified}
        label="I accept these terms for myself, and I will credit the original team."
      />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button
        className="justify-center"
        disabled={!accepted || pending || !verified}
        onClick={() =>
          start(async () => {
            setError("");
            const r = await takeAccess(projectId, slug);
            if (r?.error) setError(r.error);
          })
        }
      >
        {pending ? "Saving…" : "Continue this project"}
      </Button>
    </Card>
  );
}
