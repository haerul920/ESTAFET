"use client";

import { useActionState, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormMessage, TextField } from "@/components/ui/Field";
import { confirmTeamConsent, inviteCoOwner, removeTeamMember } from "@/app/actions/projects";
import { formatDate } from "@/lib/format";
import type { Project } from "@/lib/db/types";
import type { FormState } from "@/lib/validation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AccessFields, type AccessValue } from "@/components/features/AccessSettings";
import { saveAccessSettings } from "@/app/actions/owner";
import { WizardActions } from "./WizardActions";

interface Member {
  profile_id: string;
  full_name: string;
  role: "owner" | "co_owner";
  status: "invited" | "active" | "left";
  consented_at: string | null;
}

/** The "Team and access" step: every active member confirms that the project may be shared, and owners set access. */
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
  const tAccess = useTranslations("access");
  const tExit = useTranslations("saveExit");
  const [access, setAccess] = useState<AccessValue>({ mode: project.access_mode, max: project.max_active_adopters });
  const [accessError, setAccessError] = useState("");
  const [target, setTarget] = useState<"back" | "exit" | "next" | null>(null);
  const [saving, startSaving] = useTransition();

  function saveThenGo(which: "back" | "exit" | "next", href: string) {
    setTarget(which);
    startSaving(async () => {
      setAccessError("");
      if (access.mode !== project.access_mode || access.max !== project.max_active_adopters) {
        const r = await saveAccessSettings(project.id, access.mode, access.max);
        if (r.error) {
          setAccessError(r.error);
          return;
        }
      }
      router.push(href);
    });
  }
  const me = team.find((m) => m.profile_id === currentUserId);

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
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-line-soft bg-white p-4">
                  <div>
                    <strong>{m.full_name}</strong>
                    {m.profile_id === currentUserId ? <span className="text-text-2">{t("you")}</span> : null}
                    <div className="text-sm text-text-2">
                      {m.status === "invited"
                        ? m.profile_id.startsWith("email:")
                          ? t("invitedPendingAccount")
                          : t("invited")
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
                        loading={pending}
                        disabled={pending}
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
                      <ConfirmDialog
                        trigger={t("remove")}
                        title={t("removeTitle", { name: m.full_name })}
                        effect={t("removeEffect", { name: m.full_name })}
                        confirmLabel={t("remove")}
                        tone="danger"
                        triggerVariant="danger"
                        size="sm"
                        onConfirm={async () => {
                          await removeTeamMember(project.id, m.profile_id);
                          return {};
                        }}
                        onDone={() => router.refresh()}
                      />
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

        <form action={addAction} className="mt-5 border-t border-line pt-5">
          <input type="hidden" name="project_id" value={project.id} />
          <TextField
            label={t("inviteLabel")}
            name="email"
            type="email"
            error={addState.fieldErrors?.email}
            hint={t("inviteHint")}
            after={
              <Button type="submit" variant="outline" disabled={adding} className="shrink-0">
                <UserPlus size={18} aria-hidden="true" /> {t("invite")}
              </Button>
            }
          />
        </form>
        {addState.ok ? (
          <div className="mt-3">
            <FormMessage tone="success">{addState.message}</FormMessage>
          </div>
        ) : null}
      </Card>

      <Card as="section" aria-labelledby="access-h" className="flex flex-col gap-5">
        <h2 id="access-h" className="m-0 text-xl">
          {tAccess("title")}
        </h2>
        <AccessFields projectId={project.id} value={access} onChange={setAccess} />
      </Card>

      {accessError ? <FormMessage tone="error">{accessError}</FormMessage> : null}

      {/* Always last on the step. Each button saves the access rules first, then goes. */}
      <WizardActions
        left={
          <Button
            variant="outline"
            size="lg"
            loading={saving && target === "back"}
            disabled={saving}
            onClick={() => saveThenGo("back", `/bagikan/${project.id}/tinjau`)}
          >
            {t("back")}
          </Button>
        }
      >
        <Button
          variant="outline"
          size="lg"
          loading={saving && target === "exit"}
          disabled={saving}
          onClick={() => saveThenGo("exit", "/dasbor")}
        >
          {tExit("button")}
        </Button>
        <Button
          arrow
          size="lg"
          loading={saving && target === "next"}
          disabled={saving}
          onClick={() => saveThenGo("next", `/bagikan/${project.id}/terbit`)}
        >
          {t("next")}
        </Button>
      </WizardActions>
    </div>
  );
}
