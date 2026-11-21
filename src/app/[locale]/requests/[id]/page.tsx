import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser, initials } from "@/lib/auth";
import { getRequestDetail, getRequestMessages } from "@/lib/db/requests";
import { PageShell, Breadcrumb } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Stepper } from "@/components/ui/Stepper";
import { AgreementCard, CreditLineCard, DecisionCard, type ReviewProps } from "@/components/features/RequestReview";
import { RequestThread } from "@/components/features/RequestThread";
import { creditLine } from "@/lib/agreement/terms";
import { formatDate, formatDateTime } from "@/lib/format";
import { getLabels } from "@/lib/get-labels";
import type { TFn } from "@/lib/labels";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "review" });
  return { title: tm("metaTitle") };
}

export default async function RequestReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/requests/${id}`);
  const [locale, t, ag, L] = await Promise.all([getLocale(), getTranslations("review"), getTranslations("agreement"), getLabels()]);
  const d = await getRequestDetail(id, user.id);
  if (!d || (!d.isOwner && !d.isTeam)) notFound();
  const messages = await getRequestMessages(id, d.project.id);
  const { request: r, project } = d;

  const current = d.unlocked ? 4 : r.status === "approved" ? 2 : 1;
  const steps = [t("s1"), t("s2"), t("s3"), t("s4")].map((label) => ({ label }));
  const members = [d.requesterName || t("requesterDefault"), ...r.members.map((m) => m.email)];

  const props: ReviewProps = {
    requestId: r.id,
    status: r.status,
    isOwner: d.isOwner,
    isTeam: d.isTeam,
    unlocked: d.unlocked,
    mineAccepted: d.myAccess !== null,
    verified: user.verified,
    holders: d.holders,
    decisionNote: r.decision_note,
    decidedAt: r.decided_at,
    expiresAt: r.status === "pending" ? r.expires_at : null,
    workspaceHref: `/projects/${project.slug}/workspace`,
    creditLine: creditLine({ title: project.title, creators: d.ownerNames, advisor: project.advisor_name, lineageId: r.id.slice(0, 8) }, ag as unknown as TFn),
  };

  const statusBadge =
    r.status === "pending" ? (
      <Badge tone="warn">{d.isOwner ? t("waitingYou") : L.requestStatus.pending}</Badge>
    ) : r.status === "approved" ? (
      <Badge tone="ok">{t("approved")}</Badge>
    ) : (
      <Badge tone="neutral">{L.requestStatus[r.status]}</Badge>
    );

  return (
    <PageShell>
      <Breadcrumb items={[{ label: t("breadcrumbDashboard"), href: "/dasbor" }, { label: t("breadcrumb", { title: project.title }) }]} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 mt-0 text-4xl font-medium max-sm:text-[28px]">
            {d.isOwner ? t("titleOwner") : t("titleTeam")}
          </h1>
          <p className="m-0 text-text-2">
            {d.isOwner ? t("leadOwner") : t("leadTeam", { title: project.title })}
          </p>
        </div>
        {statusBadge}
      </div>

      <Stepper label={t("stepperLabel")} steps={steps} current={current} showNumbers={false} />

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-6">
          <Card as="section" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-[22px]">{r.adopter_team_name}</h2>
              {project.is_demo ? <DemoBadge /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {members.map((m, i) => (
                <span
                  key={m + i}
                  title={m}
                  aria-label={t("memberAria", { n: i + 1 })}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-tint text-[13px] font-semibold text-blue-dark"
                >
                  {initials(m.includes("@") ? m.split("@")[0] : m)}
                </span>
              ))}
              <span className="ml-2 text-sm text-text-2">{t("members", { count: members.length })}</span>
            </div>
            <div>
              <div className="mb-1 text-sm font-semibold text-text-2">{t("tasks")}</div>
              <div className="flex flex-wrap gap-2">
                {d.tasks.length === 0 ? (
                  <span className="text-text-2">{t("noTasks")}</span>
                ) : (
                  d.tasks.map((t) => (
                    <span key={t.id} className="rounded-full bg-blue-tint px-3 py-1 text-sm text-blue-dark">
                      {t.title}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm font-semibold text-text-2">{t("plan")}</div>
              <p className="m-0 whitespace-pre-line">{r.plan}</p>
            </div>
            {r.fit_note ? (
              <div>
                <div className="mb-1 text-sm font-semibold text-text-2">{t("fit")}</div>
                <p className="m-0">{r.fit_note}</p>
              </div>
            ) : null}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
              <div>
                <div className="mb-1 text-sm font-semibold text-text-2">{t("usedFor")}</div>
                {L.purpose[r.purpose]}
              </div>
              <div>
                <div className="mb-1 text-sm font-semibold text-text-2">{t("target")}</div>
                {r.target_date ? formatDate(r.target_date, locale) : t("notSet")}
              </div>
              <div>
                <div className="mb-1 text-sm font-semibold text-text-2">{t("sent")}</div>
                {formatDate(r.created_at, locale)}
              </div>
            </div>
          </Card>
          <DecisionCard {...props} />
          <RequestThread
            requestId={id}
            open={d.request.status === "pending" || d.request.status === "approved"}
            messages={messages.map((m) => ({
              id: m.id,
              authorName: m.authorName,
              mine: m.authorId === user.id,
              fromOwner: m.fromOwner,
              body: m.body,
              whenLabel: formatDateTime(m.createdAt, locale),
            }))}
          />
        </div>

        <aside className="flex min-w-[280px] flex-[0_1_400px] flex-col gap-4">
          <AgreementCard {...props} />
          <CreditLineCard creditLine={props.creditLine} />
        </aside>
      </div>
    </PageShell>
  );
}
