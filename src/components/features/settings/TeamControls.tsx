"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/Field";
import { inviteCoOwner, removeTeamMember } from "@/app/actions/projects";
import { cancelOwnership, proposeOwnership, respondOwnership } from "@/app/actions/owner";
import type { FormState } from "@/lib/validation";

export interface TeamRow {
  profile_id: string;
  full_name: string;
  role: "owner" | "co_owner";
  status: "invited" | "active" | "left";
}

/** Owners and co-owners: invite, remove, and hand over ownership (the recipient must accept). */
export function TeamControls({
  projectId,
  currentUserId,
  team,
  isPrimaryOwner,
  transfer,
}: {
  projectId: string;
  currentUserId: string;
  team: TeamRow[];
  isPrimaryOwner: boolean;
  transfer: { from_profile: string; to_profile: string; from_name: string; to_name: string } | null;
}) {
  const t = useTranslations("settings.team");
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(inviteCoOwner, {});
  const [pick, setPick] = useState("");
  const [answering, startAnswer] = useTransition();
  const [answerError, setAnswerError] = useState("");

  const members = team.filter((m) => m.status !== "left");
  const eligible = members.filter((m) => m.role === "co_owner" && m.status === "active");
  const target = eligible.find((m) => m.profile_id === pick);
  const offeredToMe = transfer && transfer.to_profile === currentUserId;
  const offeredByMe = transfer && transfer.from_profile === currentUserId;

  function answer(accept: boolean) {
    startAnswer(async () => {
      setAnswerError("");
      const r = await respondOwnership(projectId, accept);
      if (r.error) setAnswerError(r.error);
      else router.refresh();
    });
  }

  return (
    <Card as="section" aria-labelledby="team-h" className="flex flex-col gap-5">
      <div>
        <h2 id="team-h" className="mb-1 mt-0 text-xl">
          {t("title")}
        </h2>
        <p className="m-0 text-[15px] text-text-3">{t("text")}</p>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {members.map((m) => (
          <li
            key={m.profile_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-line-soft bg-white p-3.5"
          >
            <span className="flex flex-wrap items-center gap-2">
              <strong>{m.full_name}</strong>
              {m.profile_id === currentUserId ? <span className="text-sm text-text-2">{t("you")}</span> : null}
              <Badge tone={m.role === "owner" ? "lime" : "neutral"}>
                {m.role === "owner" ? t("roleOwner") : t("roleCo")}
              </Badge>
              {m.status === "invited" ? <Badge tone="warn">{t("invited")}</Badge> : null}
            </span>
            {m.role === "co_owner" && m.profile_id !== currentUserId ? (
              <ConfirmDialog
                trigger={t("remove")}
                title={t("removeTitle", { name: m.full_name })}
                effect={t("removeEffect", { name: m.full_name })}
                confirmLabel={t("remove")}
                tone="danger"
                triggerVariant="danger"
                size="sm"
                onConfirm={async () => {
                  await removeTeamMember(projectId, m.profile_id);
                  return {};
                }}
                onDone={() => router.refresh()}
              />
            ) : null}
          </li>
        ))}
      </ul>

      <form action={action} noValidate className="flex flex-col gap-3">
        <input type="hidden" name="project_id" value={projectId} />
        <h3 className="m-0 text-base">{t("invite")}</h3>
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label={t("inviteLabel")}
            name="email"
            type="email"
            autoComplete="off"
            error={state.fieldErrors?.email}
            className="min-w-[240px] flex-1"
          />
          <Button type="submit" variant="outlineBlue" pending={pending}>
            {t("inviteBtn")}
          </Button>
        </div>
        {state.ok && state.message ? <FormMessage tone="success">{state.message}</FormMessage> : null}
      </form>

      {isPrimaryOwner ? (
        <div className="flex flex-col gap-3 rounded-[18px] bg-surface p-4">
          <h3 className="m-0 text-base">{t("transferTitle")}</h3>
          {transfer && offeredByMe ? (
            <>
              <p className="m-0 text-sm text-text-3">{t("transferWaitingMine", { name: transfer.to_name })}</p>
              <div>
                <ConfirmDialog
                  trigger={t("transferCancel")}
                  title={t("transferCancel")}
                  effect={t("transferText")}
                  confirmLabel={t("transferCancel")}
                  onConfirm={() => cancelOwnership(projectId)}
                  onDone={() => router.refresh()}
                />
              </div>
            </>
          ) : eligible.length === 0 ? (
            <p className="m-0 text-sm text-text-3">{t("noCoOwners")}</p>
          ) : (
            <>
              <p className="m-0 text-sm text-text-3">{t("transferText")}</p>
              <div className="flex flex-wrap items-end gap-3">
                <SelectField
                  label={t("transferPick")}
                  value={pick}
                  onChange={(e) => setPick(e.target.value)}
                  className="min-w-[240px] flex-1"
                >
                  <option value="">—</option>
                  {eligible.map((m) => (
                    <option key={m.profile_id} value={m.profile_id}>
                      {m.full_name}
                    </option>
                  ))}
                </SelectField>
                {target ? (
                  <ConfirmDialog
                    trigger={t("transferBtn")}
                    title={t("transferConfirmTitle", { name: target.full_name })}
                    effect={t("transferEffect", { name: target.full_name })}
                    confirmLabel={t("transferBtn")}
                    onConfirm={() => proposeOwnership(projectId, target.profile_id)}
                    onDone={() => router.refresh()}
                  />
                ) : (
                  <Button variant="outline" disabled>
                    {t("transferBtn")}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}

      {offeredToMe && transfer ? (
        <div className="flex flex-col gap-3 rounded-[18px] bg-blue-tint p-4">
          <p className="m-0 font-semibold">{t("transferOfferedToMe", { name: transfer.from_name })}</p>
          {answerError ? <FormMessage tone="error">{answerError}</FormMessage> : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => answer(true)} disabled={answering}>
              {t("transferAccept")}
            </Button>
            <Button variant="outline" onClick={() => answer(false)} disabled={answering}>
              {t("transferDecline")}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
