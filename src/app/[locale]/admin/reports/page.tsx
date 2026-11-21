import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { ReasonAction } from "@/components/admin/ReasonDialog";
import { KeyValueList, PageHeader, Panel, StatusPill, Time, toneFor } from "@/components/admin/ui";
import { bulkDismissSpam, handleReport } from "@/app/[locale]/admin/actions";
import { NoteForm } from "@/components/admin/NoteForm";
import { getSettings } from "@/lib/settings";
import { slaFor } from "@/lib/admin/time";
import { queryView } from "@/lib/admin/query";
import { requireAdmin } from "@/lib/admin/guard";
import type { SearchParams } from "@/lib/admin/table";

export const metadata: Metadata = { title: "Reports" };

interface Row {
  id: string;
  project_id: string;
  project_title: string;
  project_slug: string;
  moderation_status: string;
  reason: string;
  details: string;
  status: string;
  resolution_note: string | null;
  reporter_contact: string | null;
  handler_name: string | null;
  handled_at: string | null;
  created_at: string;
  other_reports: number;
  handled_by: string | null;
}

const REASONS = [
  "copyright",
  "personal_data",
  "false_information",
  "inappropriate",
  "false_ownership",
  "harmful_file",
  "spam",
  "other",
];

/** Ready-made reasons. The admin can edit the text before saving. */
const TEMPLATES = {
  dismiss: [
    "The report does not describe a breach of the Community Guidelines.",
    "The content was checked and matches what the owners are allowed to share.",
    "Duplicate of a report that was already handled.",
  ],
  hold: [
    "Several reporters raised the same serious concern. The project is held while the team checks the files.",
    "The report names personal data in the project. It is held until the owners confirm it is removed.",
  ],
  hide: [
    "The project breaks the Community Guidelines: the content must be fixed before it is shown again.",
    "The owners could not show they have the right to share this work.",
  ],
  remove: [
    "The project contains content that must not be shown publicly. Data is kept; the project is removed from public view.",
  ],
};

function SlaCell({ status, createdAt, days }: { status: string; createdAt: string; days: number }) {
  if (status === "resolved" || status === "dismissed") return <span className="text-text-2">closed</span>;
  const s = slaFor(createdAt, days);
  if (s.state === "overdue") return <StatusPill tone="danger">{`overdue ${Math.abs(s.days) || 1} d`}</StatusPill>;
  return (
    <StatusPill tone={s.state === "soon" ? "warn" : "neutral"}>
      {s.state === "soon" ? "due today" : `due in ${s.days} d`}
    </StatusPill>
  );
}

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const mine = sp.mine === "1";
  const reviewDays = (await getSettings()).hold_review_days.value;
  const { rows, total, params } = await queryView<Row>("admin_reports_v", sp, {
    sortable: ["created_at", "project_title", "reason", "status"],
    defaultSort: "created_at",
    searchCols: ["project_title", "details"],
    eq: { status: "status", reason: "reason" },
    apply: (q) => (mine ? q.eq("handled_by", me.id) : q),
  });

  const openId = typeof sp.open === "string" ? sp.open : null;
  let panel: React.ReactNode = null;
  if (openId) {
    const supabase = await createClient();
    const { data: r } = await supabase.from("admin_reports_v").select("*").eq("id", openId).maybeSingle();
    if (r) {
      const report = r as Row;
      const [{ data: detail }, { data: prior }] = await Promise.all([
        supabase.rpc("admin_project_detail", { p_id: report.project_id }),
        supabase
          .from("admin_reports_v")
          .select("id, reason, status, created_at")
          .eq("project_id", report.project_id)
          .neq("id", openId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      const d = detail as { project: { summary: string }; creators: { name: string }[] } | null;
      const closed = report.status === "resolved" || report.status === "dismissed";
      panel = (
        <aside aria-label="Report details" className="mb-6 rounded-3xl border-2 border-blue bg-white p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <h2 className="m-0 text-lg">Report on {report.project_title}</h2>
            <Link href={`/admin/reports${""}`} className="text-sm" aria-label="Close the report panel">
              Close
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Panel title="The report">
                <KeyValueList
                  items={[
                    { label: "Reason", value: <StatusPill tone="warn">{report.reason.replace("_", " ")}</StatusPill> },
                    {
                      label: "Status",
                      value: <StatusPill tone={toneFor(report.status)}>{report.status.replace("_", " ")}</StatusPill>,
                    },
                    { label: "Details", value: report.details || "—" },
                    { label: "Contact", value: report.reporter_contact || "none given" },
                    { label: "Received", value: <Time iso={report.created_at} /> },
                    ...(report.resolution_note ? [{ label: "Resolution", value: report.resolution_note }] : []),
                  ]}
                />
              </Panel>
              <Panel title={`Earlier reports on this project (${(prior ?? []).length})`}>
                {(prior ?? []).length === 0 ? (
                  <p className="m-0 text-sm text-text-2">None.</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                    {(prior as { id: string; reason: string; status: string; created_at: string }[]).map((p) => (
                      <li key={p.id}>
                        <Link href={`/admin/reports?open=${p.id}`}>{p.reason.replace("_", " ")}</Link> · {p.status} ·{" "}
                        <Time iso={p.created_at} className="inline" />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
            <div className="flex flex-col gap-3">
              <Panel title="Project">
                <KeyValueList
                  items={[
                    {
                      label: "Moderation",
                      value: (
                        <StatusPill tone={toneFor(report.moderation_status)}>{report.moderation_status}</StatusPill>
                      ),
                    },
                    { label: "Owners", value: d?.creators.map((c) => c.name).join(", ") || "—" },
                    { label: "Teaser summary", value: d?.project.summary || "—" },
                  ]}
                />
                <p className="mb-0 mt-3 text-sm">
                  <Link href={`/admin/projects/${report.project_id}`}>Open the project page</Link>
                </p>
              </Panel>
              <Panel title="Internal note">
                <NoteForm targetType="project" targetId={report.project_id} />
              </Panel>
              <Panel title="Decision">
                {closed ? (
                  <p className="m-0 text-sm text-text-2">This report is closed.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <ReasonAction
                      label="Dismiss"
                      reasonLabel="Resolution note (kept in the audit log)"
                      templates={TEMPLATES.dismiss}
                      consequence={<>The report is closed as dismissed. The project is not changed.</>}
                      action={handleReport.bind(null, openId, "dismiss")}
                    />
                    {report.status === "open" ? (
                      <ReasonAction
                        label="Mark in review"
                        reasonLabel="Note on what you are checking"
                        consequence={<>The report moves to In review so teammates know someone is on it.</>}
                        action={handleReport.bind(null, openId, "in_review")}
                      />
                    ) : null}
                    <ReasonAction
                      label="Hold project"
                      reasonLabel="Why you are holding it"
                      templates={TEMPLATES.hold}
                      consequence={
                        <>
                          The project is held while you review it: it leaves public pages and the public sees a neutral
                          notice. The report is resolved. The owners are told and can appeal.
                        </>
                      }
                      action={handleReport.bind(null, report.id, "hold")}
                      successMessage="Project held."
                    />
                    <ReasonAction
                      label="Hide project"
                      consequence={
                        <>
                          The project disappears from Explore and its page returns 404. The report is resolved. The
                          creators are told your note.
                        </>
                      }
                      action={handleReport.bind(null, openId, "hide")}
                      reasonLabel="Resolution note (shown to the creators)"
                      templates={TEMPLATES.hide}
                    />
                    <ReasonAction
                      label="Remove project"
                      tone="danger"
                      consequence={
                        <>
                          Like Hide, but marked as removed. Data and signed agreements are kept. Needs a recent password
                          check.
                        </>
                      }
                      action={handleReport.bind(null, openId, "remove")}
                      reasonLabel="Resolution note (shown to the creators)"
                      templates={TEMPLATES.remove}
                    />
                  </div>
                )}
              </Panel>
            </div>
          </div>
        </aside>
      );
    }
  }

  const columns: Column<Row>[] = [
    {
      key: "created_at",
      label: "Reported",
      sortable: true,
      render: (r) => <Time iso={r.created_at} className="text-ink" />,
    },
    { key: "project_title", label: "Project", sortable: true, render: (r) => r.project_title },
    { key: "reason", label: "Reason", sortable: true, render: (r) => r.reason.replace("_", " ") },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (r) => <StatusPill tone={toneFor(r.status)}>{r.status.replace("_", " ")}</StatusPill>,
    },
    {
      key: "sla",
      label: `Review target (${reviewDays} d)`,
      render: (r) => <SlaCell status={r.status} createdAt={r.created_at} days={reviewDays} />,
    },
    { key: "handler_name", label: "Handler", render: (r) => r.handler_name ?? "—" },
  ];
  const openSpam = rows.filter((r) => r.reason === "spam" && (r.status === "open" || r.status === "in_review"));

  return (
    <>
      <PageHeader
        title="Reports"
        intro="Content reports sent from public project pages. Every outcome needs a resolution note."
      />
      {panel}
      {openSpam.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-4 text-sm">
          <span>
            <strong>{openSpam.length}</strong> open spam {openSpam.length === 1 ? "report is" : "reports are"} on this
            page. Check them first, then dismiss them together.
          </span>
          <ReasonAction
            small
            label={`Dismiss ${openSpam.length} spam`}
            consequence={
              <>
                Only reports with the reason &ldquo;spam&rdquo; that are listed on this page are dismissed. Each one is
                audited on its own and no project is changed.
              </>
            }
            reasonLabel="Resolution note (kept in the audit log)"
            templates={TEMPLATES.dismiss}
            action={bulkDismissSpam.bind(
              null,
              openSpam.slice(0, 50).map((r) => r.id),
            )}
            successMessage="Spam reports dismissed."
          />
        </div>
      ) : null}
      <FilterBar
        searchLabel="Search project or details"
        toggles={[{ key: "mine", label: "Assigned to me" }]}
        filters={[
          {
            key: "status",
            label: "Status",
            options: ["open", "in_review", "resolved", "dismissed"].map((v) => ({
              value: v,
              label: v.replace("_", " "),
            })),
          },
          { key: "reason", label: "Reason", options: REASONS.map((v) => ({ value: v, label: v.replace("_", " ") })) },
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        params={params}
        sp={sp}
        basePath="/admin/reports"
        rowHref={(r) => `/admin/reports?open=${r.id}`}
        caption="Content reports"
        selectedId={openId}
        empty={{ title: "No reports", text: "Nothing has been reported, or a filter hides it." }}
      />
    </>
  );
}
