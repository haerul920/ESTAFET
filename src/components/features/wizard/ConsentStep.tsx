"use client";

import { useActionState, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Link2, UserPlus, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormMessage, TextField } from "@/components/ui/Field";
import { confirmTeamConsent, createConsentLink, declareNoAdvisor, inviteCoOwner, removeTeamMember } from "@/app/actions/projects";
import { formatDate } from "@/lib/format";
import type { AdvisorConsent, Project } from "@/lib/db/types";
import type { FormState } from "@/lib/validation";

interface Member {
  profile_id: string;
  full_name: string;
  role: "owner" | "co_owner";
  status: "invited" | "active" | "left";
  consented_at: string | null;
}

export function ConsentStep({
  project,
  team,
  currentUserId,
  consent,
}: {
  project: Project;
  team: Member[];
  currentUserId: string;
  consent: AdvisorConsent | null;
}) {
  const t = useTranslations("consentStep");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addState, addAction, adding] = useActionState<FormState, FormData>(inviteCoOwner, {});
  const [link, setLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [advisorError, setAdvisorError] = useState("");
  const me = team.find((m) => m.profile_id === currentUserId);
  const active = team.filter((m) => m.status === "active");
  const allConfirmed = active.length > 0 && active.every((m) => m.consented_at);
  const advisorName = project.advisor_name || t("advisorDefault");

  function makeLink() {
    setLinkError("");
    start(async () => {
      const res = await createConsentLink(project.id);
      if (res.url) {
        setLink(res.url);
        setCopied(false);
        router.refresh();
      } else setLinkError(res.error ?? t("linkCouldNot"));
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setLinkError(t("copyBlocked"));
    }
  }

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
                      <button
                        type="button"
                        aria-label={t("removeAria", { name: m.full_name })}
                        onClick={() => start(async () => { await removeTeamMember(project.id, m.profile_id); router.refresh(); })}
                        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-text-2 hover:bg-surface"
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
        {confirmError ? <div className="mt-3"><FormMessage tone="error">{confirmError}</FormMessage></div> : null}
        {me && !me.consented_at ? <p className="mb-0 mt-3 text-sm text-text-2">{t("confirmNote")}</p> : null}

        <form action={addAction} className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
          <input type="hidden" name="project_id" value={project.id} />
          <TextField label={t("inviteLabel")} name="email" type="email" className="min-w-[240px] flex-1" error={addState.fieldErrors?.email} hint={t("inviteHint")} />
          <Button type="submit" variant="outline" disabled={adding}>
            <UserPlus size={18} aria-hidden="true" /> {t("invite")}
          </Button>
        </form>
        {addState.ok ? <div className="mt-3"><FormMessage tone="success">{addState.message}</FormMessage></div> : null}
      </Card>

      <Card as="section" aria-labelledby="advisor-h">
        <h2 id="advisor-h" className="mb-1 mt-0 text-[22px]">
          {t("advisorTitle")}
        </h2>
        <p className="mb-4 mt-0 text-[15px] text-text-2">{t("advisorIntro", { name: advisorName })}</p>
        <div className="mb-4 rounded-[14px] bg-warn-bg p-4 text-[15px] text-warn-ink">{t("noEmail")}</div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold">{t("status")}</span>
          {project.advisor_mode === "none" ? (
            <Badge tone="info">{t("stDeclared")}</Badge>
          ) : consent?.status === "approved" ? (
            <Badge tone="ok">{t("stApproved", { date: consent.decided_at ? formatDate(consent.decided_at, locale) : "" })}</Badge>
          ) : consent?.status === "pending" ? (
            <Badge tone="warn">{t("stPending")}</Badge>
          ) : consent?.status === "declined" ? (
            <Badge tone="danger">{t("stDeclined")}</Badge>
          ) : consent?.status === "withdrawn" ? (
            <Badge tone="neutral">{t("stWithdrawn")}</Badge>
          ) : (
            <Badge tone="neutral">{t("stNone")}</Badge>
          )}
          {consent?.comment ? <span className="text-sm text-text-2">{t("comment", { comment: consent.comment })}</span> : null}
        </div>

        {consent?.status !== "approved" ? (
          <>
            <div className="flex flex-wrap gap-3">
              <Button onClick={makeLink} disabled={pending} variant={link ? "outline" : "primary"}>
                <Link2 size={18} aria-hidden="true" />
                {link || consent?.status === "pending" ? t("createNew") : t("createLink")}
              </Button>
              {project.advisor_mode !== "none" ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      setAdvisorError("");
                      const r = await declareNoAdvisor(project.id);
                      if (r.error) setAdvisorError(r.error);
                      else router.refresh();
                    })
                  }
                >
                  {t("noAdvisorBtn")}
                </Button>
              ) : null}
            </div>
            {project.advisor_mode === "none" ? <p className="mb-0 mt-2 text-sm text-text-2">{t("noAdvisorNote")}</p> : null}
            {advisorError ? <div className="mt-3"><FormMessage tone="error">{advisorError}</FormMessage></div> : null}
            {consent?.status === "pending" && !link ? <p className="mb-0 mt-2 text-sm text-text-2">{t("linkOut")}</p> : null}
          </>
        ) : null}
        {linkError ? <div className="mt-3"><FormMessage tone="error">{linkError}</FormMessage></div> : null}
        <AnimatePresence>
          {link ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 flex flex-col gap-2">
              <label htmlFor="consent-link" className="text-sm font-semibold">
                {t("linkLabel", { name: advisorName })}
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="consent-link"
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-h-[48px] min-w-0 flex-1 rounded-[14px] border border-line-strong bg-white px-3.5 font-code text-[13px]"
                />
                <Button variant="outlineBlue" onClick={copy}>
                  {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                  {copied ? t("copied") : t("copy")}
                </Button>
              </div>
              <p role="status" className="m-0 text-[13px] text-text-2">
                {t("shownOnce")}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
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
