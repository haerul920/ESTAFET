"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Link2, UserPlus, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormMessage, TextField } from "@/components/ui/Field";
import { addTeamMember, confirmTeamConsent, createConsentLink, removeTeamMember } from "@/app/actions/projects";
import { formatDate } from "@/lib/labels";
import type { AdvisorConsent, Project } from "@/lib/db/types";
import type { FormState } from "@/lib/validation";

interface Member {
  profile_id: string;
  full_name: string;
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
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addState, addAction, adding] = useActionState<FormState, FormData>(addTeamMember, {});
  const [link, setLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const me = team.find((m) => m.profile_id === currentUserId);
  const allConfirmed = team.length > 0 && team.every((m) => m.consented_at);

  function makeLink() {
    setLinkError("");
    start(async () => {
      const res = await createConsentLink(project.id);
      if (res.url) {
        setLink(res.url);
        setCopied(false);
        router.refresh();
      } else setLinkError(res.error ?? "Could not create the link.");
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setLinkError("Your browser blocked copying. Select the link and copy it by hand.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card as="section" aria-labelledby="team-h">
        <h2 id="team-h" className="mb-1 mt-0 text-[22px]">
          1. Your team agrees
        </h2>
        <p className="mb-4 mt-0 text-[15px] text-text-2">
          Every former team member who worked on this project must confirm that they are happy to share it. Teammates
          need an ESTAFET account first.
        </p>
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
                    {m.profile_id === currentUserId ? <span className="text-text-2"> (you)</span> : null}
                    <div className="text-sm text-text-2">
                      {m.consented_at ? `Confirmed ${formatDate(m.consented_at)}` : "Has not confirmed yet"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.consented_at ? (
                      <Badge tone="ok">
                        <Check size={14} aria-hidden="true" /> Confirmed
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
                        I confirm
                      </Button>
                    ) : (
                      <Badge tone="warn">Waiting</Badge>
                    )}
                    {m.profile_id !== project.created_by ? (
                      <button
                        type="button"
                        aria-label={`Remove ${m.full_name} from the team`}
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
        {me && !me.consented_at ? (
          <p className="mb-0 mt-3 text-sm text-text-2">
            By confirming you agree that the title, summary, objectives, verified tasks and lessons you approve become public.
          </p>
        ) : null}

        <form action={addAction} className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
          <input type="hidden" name="project_id" value={project.id} />
          <TextField
            label="Add a teammate by email"
            name="email"
            type="email"
            className="min-w-[240px] flex-1"
            error={addState.fieldErrors?.email}
            hint="Their ESTAFET account email."
          />
          <Button type="submit" variant="outline" disabled={adding}>
            <UserPlus size={18} aria-hidden="true" /> Add
          </Button>
        </form>
        {addState.ok ? <div className="mt-3"><FormMessage tone="success">{addState.message}</FormMessage></div> : null}
      </Card>

      <Card as="section" aria-labelledby="advisor-h">
        <h2 id="advisor-h" className="mb-1 mt-0 text-[22px]">
          2. Your advisor approves
        </h2>
        <p className="mb-4 mt-0 text-[15px] text-text-2">
          {project.advisor_name || "Your advisor"} approves through a private link. No account is needed. The link
          works once for a single decision and expires after 14 days.
        </p>
        <div className="mb-4 rounded-[14px] bg-warn-bg p-4 text-[15px] text-warn-ink">
          <strong>ESTAFET does not send email.</strong> Create the link, copy it, and send it to your advisor yourself
          (chat or email).
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold">Status:</span>
          {consent?.status === "approved" ? (
            <Badge tone="ok">Approved {consent.decided_at ? formatDate(consent.decided_at) : ""}</Badge>
          ) : consent?.status === "pending" ? (
            <Badge tone="warn">Waiting for your advisor</Badge>
          ) : consent?.status === "declined" ? (
            <Badge tone="danger">Advisor said not now</Badge>
          ) : consent?.status === "withdrawn" ? (
            <Badge tone="neutral">Link replaced or approval withdrawn</Badge>
          ) : (
            <Badge tone="neutral">Not requested yet</Badge>
          )}
          {consent?.comment ? <span className="text-sm text-text-2">Comment: &ldquo;{consent.comment}&rdquo;</span> : null}
        </div>

        {consent?.status !== "approved" ? (
          <>
            <div className="flex flex-wrap gap-3">
              <Button onClick={makeLink} disabled={pending} variant={link ? "outline" : "primary"}>
                <Link2 size={18} aria-hidden="true" />
                {link || consent?.status === "pending" ? "Create a new link" : "Create consent link"}
              </Button>
            </div>
            {consent?.status === "pending" && !link ? (
              <p className="mb-0 mt-2 text-sm text-text-2">
                A link is already out. For safety it cannot be shown again, so creating a new one replaces it.
              </p>
            ) : null}
          </>
        ) : null}
        {linkError ? <div className="mt-3"><FormMessage tone="error">{linkError}</FormMessage></div> : null}
        <AnimatePresence>
          {link ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex flex-col gap-2"
            >
              <label htmlFor="consent-link" className="text-sm font-semibold">
                Private link for {project.advisor_name || "your advisor"}
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
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </div>
              <p role="status" className="m-0 text-[13px] text-text-2">
                Shown once. Anyone with this link can approve for 14 days, so send it only to your advisor.
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <ButtonLink href={`/share/${project.id}/basics`} variant="outline">
          Back
        </ButtonLink>
        <ButtonLink href={`/share/${project.id}/files`} arrow size="lg">
          {allConfirmed && consent?.status === "approved" ? "Continue to files" : "Continue to files (you can finish consent later)"}
        </ButtonLink>
      </div>
    </div>
  );
}
