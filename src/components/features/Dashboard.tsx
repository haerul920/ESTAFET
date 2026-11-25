"use client";

import { useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { FolderPlus, Inbox, KeyRound, Send, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { CountUp, Stagger, HoverLift, StaggerItem } from "@/components/ui/motion";
import { respondToInvite } from "@/app/actions/projects";
import { deleteDraftProject } from "@/app/actions/owner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useLabels } from "@/lib/use-labels";
import { cn } from "@/lib/cn";
import type {
  DashboardAccess,
  DashboardData,
  DashboardInvitation,
  DashboardProject,
  DashboardRequest,
} from "@/lib/db/dashboard";

function DeleteDraft({ p }: { p: DashboardProject }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const toast = useToast();
  return (
    <ConfirmDialog
      trigger={t("delete.trigger")}
      title={t("delete.title", { title: p.title })}
      effect={t("delete.effect")}
      confirmLabel={t("delete.confirm")}
      tone="danger"
      triggerVariant="danger"
      onConfirm={() => deleteDraftProject(p.id)}
      onDone={() => {
        toast.push({ message: t("delete.done", { title: p.title }) });
        router.refresh();
      }}
    />
  );
}

function ProjectRow({ p }: { p: DashboardProject }) {
  const t = useTranslations("dashboard");
  return (
    <StaggerItem>
      <HoverLift>
        <Card className="lift flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="mb-1 mt-0 text-[22px]">
                <Link href={`/projects/${p.slug}`} className="text-ink no-underline hover:underline">
                  {p.title}
                </Link>
              </h3>
              <span className="flex flex-wrap items-center gap-2 text-sm text-text-2">
                <Badge tone={p.status === "published" ? "ok" : p.status === "draft" ? "info" : "neutral"}>
                  {p.statusLabel}
                </Badge>
                {p.meta}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {p.canDelete ? <DeleteDraft p={p} /> : null}
              <ButtonLink
                href={p.href}
                variant={p.ctaTone === "lime" ? "primary" : p.ctaTone === "blue" ? "darkSolid" : "outline"}
                size="md"
                className={p.ctaTone === "blue" ? "!bg-blue" : ""}
              >
                {p.cta}
              </ButtonLink>
            </div>
          </div>
          {p.status !== "draft" ? (
            <Link
              href={`/proyek/${p.slug}/pengaturan`}
              className="link-anim self-start text-sm font-semibold text-blue"
            >
              {t("p.settings")}
            </Link>
          ) : null}
          <div
            className={cn(
              "rounded-[14px] px-4 py-3 text-[15px] text-text-3",
              p.noteTone === "warn" ? "bg-warn-bg" : p.noteTone === "blue" ? "bg-blue-tint" : "bg-chip",
            )}
          >
            {p.note}
          </div>
        </Card>
      </HoverLift>
    </StaggerItem>
  );
}

function RequestRow({ r, incoming }: { r: DashboardRequest; incoming: boolean }) {
  const t = useTranslations("dashboard");
  const L = useLabels();
  const tone = r.status === "approved" ? "ok" : r.status === "pending" ? "warn" : "neutral";
  const label =
    incoming && r.status === "pending"
      ? t("waitingDecision")
      : r.status === "approved" && r.unlocked
        ? t("accessActive")
        : r.status === "approved" && !incoming
          ? t("approvedLabel")
          : L.requestStatus[r.status];
  return (
    <StaggerItem>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <strong>{r.projectTitle}</strong>
          <br />
          <span className="text-sm text-text-2">
            {incoming ? `${r.team} · ` : ""}
            {r.meta}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={r.unlocked ? "ok" : tone}>{label}</Badge>
          {r.needsAgreement && !incoming ? <Badge tone="lime">{t("acceptAgreement")}</Badge> : null}
          <ButtonLink href={`/requests/${r.id}`} variant="outline" size="md">
            {incoming && r.status === "pending" ? t("review") : t("open")}
          </ButtonLink>
        </div>
      </Card>
    </StaggerItem>
  );
}

function AccessRow({ a }: { a: DashboardAccess }) {
  const t = useTranslations("dashboard");
  return (
    <StaggerItem>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <strong>{a.projectTitle}</strong>
          <br />
          <span className="text-sm text-text-2">{a.meta}</span>
          {!a.active && a.revokedReason ? (
            <div className="mt-1 text-sm text-text-2">{t("revokedReason", { reason: a.revokedReason })}</div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={a.active ? "ok" : "neutral"}>{a.active ? t("accessActive") : t("accessRevoked")}</Badge>
          {a.active ? (
            <ButtonLink href={`/projects/${a.projectSlug}/workspace`} variant="outline" size="md">
              {t("openWorkspace")}
            </ButtonLink>
          ) : null}
        </div>
      </Card>
    </StaggerItem>
  );
}

function InvitationRow({ i }: { i: DashboardInvitation }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const answer = (accept: boolean) =>
    start(async () => {
      setError("");
      const r = await respondToInvite(i.projectId, accept);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  return (
    <StaggerItem>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong>{i.title}</strong>
            <br />
            <span className="text-sm text-text-2">{t("inviteText")}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="md" loading={pending} disabled={pending} onClick={() => answer(true)}>
              {t("accept")}
            </Button>
            <Button variant="outline" size="md" loading={pending} disabled={pending} onClick={() => answer(false)}>
              {t("decline")}
            </Button>
          </div>
        </div>
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      </Card>
    </StaggerItem>
  );
}

function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-line-strong bg-surface p-10 text-center">
      {icon}
      <h3 className="m-0 text-xl font-medium">{title}</h3>
      <p className="m-0 max-w-sm text-text-2">{text}</p>
      {action}
    </div>
  );
}

/** One view, two sections. Nothing here depends on an account type: the same person can share and continue. */
export function Dashboard({ data }: { data: DashboardData }) {
  const t = useTranslations("dashboard");

  const tiles = [
    {
      n: data.tiles.decisions,
      label: t("tileDecisions", { count: data.tiles.decisions }),
      cls: "bg-warn-bg text-warn",
    },
    { n: data.tiles.drafts, label: t("tileDrafts", { count: data.tiles.drafts }), cls: "bg-blue-tint text-blue-dark" },
    { n: data.tiles.sentPending, label: t("tileSent", { count: data.tiles.sentPending }), cls: "bg-surface text-ink" },
  ];

  return (
    <div className="flex flex-col gap-10">
      <Stagger className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
        {tiles.map((t) => (
          <StaggerItem key={t.label} className={cn("rounded-[28px] p-5", t.cls)}>
            <div className="text-4xl font-medium leading-none">
              <CountUp to={t.n} />
            </div>
            <div className="mt-2 font-semibold text-ink">{t.label}</div>
          </StaggerItem>
        ))}
      </Stagger>

      {data.invitations.length > 0 ? (
        <section id="undangan" className="flex scroll-mt-6 flex-col gap-3" aria-labelledby="invites-h">
          <h2 id="invites-h" className="m-0 flex items-center gap-2 text-[26px]">
            <UserPlus size={22} aria-hidden="true" /> {t("invitations")}
          </h2>
          <Stagger className="flex flex-col gap-3">
            {data.invitations.map((i) => (
              <InvitationRow key={i.projectId} i={i} />
            ))}
          </Stagger>
        </section>
      ) : null}

      <section id="proyek-saya" className="flex scroll-mt-6 flex-col gap-4" aria-labelledby="mine-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="mine-h" className="m-0 text-[26px]">
            {t("mineTitle")}
          </h2>
          {data.mine.length > 0 ? (
            <ButtonLink href="/bagikan" variant="outline" size="md">
              {t("shareAnother")}
            </ButtonLink>
          ) : null}
        </div>
        {data.mine.length === 0 ? (
          <Empty
            icon={<FolderPlus size={36} className="text-blue" aria-hidden="true" />}
            title={t("mineEmptyTitle")}
            text={t("mineEmptyText")}
            action={
              <ButtonLink href="/bagikan" arrow>
                {t("shareCta")}
              </ButtonLink>
            }
          />
        ) : (
          <Stagger className="flex flex-col gap-4">
            {data.mine.map((p) => (
              <ProjectRow key={p.id} p={p} />
            ))}
          </Stagger>
        )}
        {data.incoming.length > 0 ? (
          <div className="mt-2 flex flex-col gap-3">
            <h3 className="m-0 flex items-center gap-2 text-lg">
              <Inbox size={18} aria-hidden="true" /> {t("incomingTitle")}
            </h3>
            <Stagger className="flex flex-col gap-3">
              {data.incoming.map((r) => (
                <RequestRow key={r.id} r={r} incoming />
              ))}
            </Stagger>
          </div>
        ) : null}
      </section>

      <section id="proyek-lanjutan" className="flex scroll-mt-6 flex-col gap-4" aria-labelledby="cont-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="cont-h" className="m-0 text-[26px]">
            {t("contTitle")}
          </h2>
          {data.access.length + data.sent.length > 0 ? (
            <ButtonLink href="/explore" variant="outline" size="md">
              {t("explore")}
            </ButtonLink>
          ) : null}
        </div>
        {data.access.length + data.sent.length === 0 ? (
          <Empty
            icon={<Send size={36} className="text-blue" aria-hidden="true" />}
            title={t("contEmptyTitle")}
            text={t("contEmptyText")}
            action={
              <ButtonLink href="/explore" arrow>
                {t("explore")}
              </ButtonLink>
            }
          />
        ) : (
          <>
            {data.access.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h3 className="m-0 flex items-center gap-2 text-lg">
                  <KeyRound size={18} aria-hidden="true" /> {t("accessHeld")}
                </h3>
                <Stagger className="flex flex-col gap-3">
                  {data.access.map((a) => (
                    <AccessRow key={a.id} a={a} />
                  ))}
                </Stagger>
              </div>
            ) : null}
            {data.sent.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h3 className="m-0 flex items-center gap-2 text-lg">
                  <Send size={18} aria-hidden="true" /> {t("requestsSent")}
                </h3>
                <Stagger className="flex flex-col gap-3">
                  {data.sent.map((r) => (
                    <RequestRow key={r.id} r={r} incoming={false} />
                  ))}
                </Stagger>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
