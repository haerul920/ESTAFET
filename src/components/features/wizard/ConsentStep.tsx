"use client";

import { useActionState, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, UserPlus, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormMessage, TextField } from "@/components/ui/Field";
import { confirmTeamConsent, inviteCoOwner, removeTeamMember } from "@/app/actions/projects";
import { formatDate } from "@/lib/format";
import type { Project } from "@/lib/db/types";
import type { FormState } from "@/lib/validation";

interface Member {
  profile_id: string;
  full_name: string;
  role: "owner" | "co_owner";
  status: "invited" | "active" | "left";
  consented_at: string | null;
}

/** The team part of "Team and access": every active member confirms that the project may be shared. */
export function ConsentStep({
  project,
  team,
  currentUserId,
}: {
  project: Project;
  team: Member[];
  currentUserId: string;
}) {
  const t = useTranslations("consentStep");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addState, addAction, adding] = useActionState<FormState, FormData>(inviteCoOwner, {});
  const [confirmError, setConfirmError] = useState("");
  const me = team.find((m) => m.profile_id === currentUserId);
  const active = team.filter((m) => m.status === "active");
  const allConfirmed = active.length > 0 && active.every((m) => m.consented_at);

  return (
    <div className="flex flex-col gap-6">
      <Card as="section" aria-labelledby="team-h">
        <h2 id="team-h" className="mb-1 mt-0 text-[22px]">
          {t("teamTitle")}
        </h2>
        <p className="mb-4 mt-0 text-[15px] text-text-2">{t("teamIntro")}</p>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          <AnimatePresence initial={false}>
            {team.map((m) => (
              <motion.li
                key={m.profile_id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-line-soft bg-white p-4">
                  <div>
                    <strong>{m.full_name}</strong>
                    {m.profile_id === currentUserId ? <span className="text-text-2">{t("you")}</span> : null}
                    <div className="text-sm text-text-2">
                      {m.status === "invited"
                        ? t("invited")
                        : m.consented_at
                          ? t("confirmedOn", { date: formatDate(m.consented_at, locale) })
                          : t("notConfirmed")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.status === "invited" ? (
                      <Badge tone="neutral">{t("badgeInvited")}</Badge>
                    ) : m.consented_at ? (
                      <Badge tone="ok">
                        <Check size={14} aria-hidden="true" /> {t("badgeConfirmed")}
                      </Badge>
                    ) : m.profile_id === currentUserId ? (
                      <Button
                        size="md"
                        pending={pending}
                        onClick={() =>
                          start(async () => {
                            const r = await confirmTeamConsent(project.id);
                            if (r.error) setConfirmError(r.error);
                            else router.refresh();
                          })
                        }
                      >
                        {t("confirmBtn")}
                      </Button>
                    ) : (
                      <Badge tone="warn">{t("waiting")}</Badge>
                    )}
                    {m.role !== "owner" ? (
                      <button
                        type="button"
                        aria-label={t("removeAria", { name: m.full_name })}
                        onClick={() =>
                          start(async () => {
                            await removeTeamMember(project.id, m.profile_id);
                            router.refresh();
                          })
                        }
                        className="icon-btn flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-text-2 hover:bg-surface"
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {confirmError ? (
          <div className="mt-3">
            <FormMessage tone="error">{confirmError}</FormMessage>
          </div>
        ) : null}
        {me && !me.consented_at ? <p className="mb-0 mt-3 text-sm text-text-2">{t("confirmNote")}</p> : null}

        <form action={addAction} className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
          <input type="hidden" name="project_id" value={project.id} />
          <TextField
            label={t("inviteLabel")}
            name="email"
            type="email"
            className="min-w-[240px] flex-1"
            error={addState.fieldErrors?.email}
            hint={t("inviteHint")}
          />
          <Button type="submit" variant="outline" disabled={adding}>
            <UserPlus size={18} aria-hidden="true" /> {t("invite")}
          </Button>
        </form>
        {addState.ok ? (
          <div className="mt-3">
            <FormMessage tone="success">{addState.message}</FormMessage>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <ButtonLink href={`/bagikan/${project.id}/tinjau`} variant="outline">
          {t("back")}
        </ButtonLink>
        <ButtonLink href={`/bagikan/${project.id}/terbit`} arrow size="lg">
          {allConfirmed ? t("next") : t("nextLater")}
        </ButtonLink>
      </div>
    </div>
  );
}
