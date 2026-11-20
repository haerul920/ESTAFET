import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser, initials } from "@/lib/auth";
import { getRequestDetail } from "@/lib/db/requests";
import { PageShell, Breadcrumb } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Stepper } from "@/components/ui/Stepper";
import { AgreementCard, CreditLineCard, DecisionCard, type ReviewProps } from "@/components/features/RequestReview";
import { creditLine } from "@/lib/agreement/terms";
import { PURPOSE_LABEL, formatDate, REQUEST_STATUS_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Continuation request" };

export default async function RequestReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/requests/${id}`);
  const d = await getRequestDetail(id, user.id);
  if (!d || (!d.isCreator && !d.isTeam)) notFound();
  const { request: r, project } = d;

  const current = d.unlocked ? 4 : r.status === "approved" ? 2 : r.status === "pending" ? 1 : 1;
  const steps = ["1. Read the plan", "2. Decide", "3. Accept the agreement", "4. Files unlock"].map((label) => ({ label }));
  const members = [d.requesterName, ...r.members.map((m) => m.email)];

  const props: ReviewProps = {
    requestId: r.id,
    status: r.status,
    isCreator: d.isCreator,
    isTeam: d.isTeam,
    unlocked: d.unlocked,
    creatorAccepted: d.creatorAccepted,
    adopterAccepted: d.adopterAccepted,
    mineAccepted: d.mineAccepted,
    creatorAcceptedBy: d.acceptances.filter((a) => a.side === "creator").map((a) => a.name),
    adopterAcceptedBy: d.acceptances.filter((a) => a.side === "adopter").map((a) => a.name),
    decisionNote: r.decision_note,
    decidedAt: r.decided_at,
    workspaceHref: `/projects/${project.slug}/workspace`,
    creditLine: creditLine({ title: project.title, creators: d.creatorNames, advisor: project.advisor_name, lineageId: r.id.slice(0, 8) }),
  };

  const statusBadge =
    r.status === "pending" ? (
      <Badge tone="warn">{d.isCreator ? "Waiting for your decision" : REQUEST_STATUS_LABEL.pending}</Badge>
    ) : r.status === "approved" ? (
      <Badge tone="ok">Approved</Badge>
    ) : (
      <Badge tone="neutral">{REQUEST_STATUS_LABEL[r.status]}</Badge>
    );

  return (
    <PageShell>
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: `Request for ${project.title}` }]} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 mt-0 text-4xl font-medium max-sm:text-[28px]">
            {d.isCreator ? "A team wants to continue your project" : "Your request to continue this project"}
          </h1>
          <p className="m-0 text-text-2">
            {d.isCreator
              ? "Read their plan, then decide. Your private files stay locked until you approve."
              : `You asked to continue ${project.title}. The original team decides, then both sides accept the agreement.`}
          </p>
        </div>
        {statusBadge}
      </div>

      <Stepper label="Request progress" steps={steps} current={current} showNumbers={false} />

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
                  aria-label={`Member ${i + 1}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-tint text-[13px] font-semibold text-blue-dark"
                >
                  {initials(m.includes("@") ? m.split("@")[0] : m)}
                </span>
              ))}
              <span className="ml-2 text-sm text-text-2">{members.length} members</span>
            </div>
            <div>
              <div className="mb-1 text-sm font-semibold text-text-2">Tasks they will take on</div>
              <div className="flex flex-wrap gap-2">
                {d.tasks.length === 0 ? (
                  <span className="text-text-2">No tasks listed.</span>
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
              <div className="mb-1 text-sm font-semibold text-text-2">Their plan for the first month</div>
              <p className="m-0 whitespace-pre-line">{r.plan}</p>
            </div>
            {r.fit_note ? (
              <div>
                <div className="mb-1 text-sm font-semibold text-text-2">Why they are a good fit</div>
                <p className="m-0">{r.fit_note}</p>
              </div>
            ) : null}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
              <div>
                <div className="mb-1 text-sm font-semibold text-text-2">Used for</div>
                {PURPOSE_LABEL[r.purpose]}
              </div>
              <div>
                <div className="mb-1 text-sm font-semibold text-text-2">Target date</div>
                {r.target_date ? formatDate(r.target_date) : "Not set"}
              </div>
              <div>
                <div className="mb-1 text-sm font-semibold text-text-2">Sent</div>
                {formatDate(r.created_at)}
              </div>
            </div>
          </Card>
          <DecisionCard {...props} />
        </div>

        <aside className="flex min-w-[280px] flex-[0_1_400px] flex-col gap-4">
          <AgreementCard {...props} />
          <CreditLineCard creditLine={props.creditLine} />
        </aside>
      </div>
    </PageShell>
  );
}
