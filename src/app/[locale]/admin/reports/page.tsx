import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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
import { statusText, type StatusTranslator } from "@/lib/admin/labels";
import { queryView } from "@/lib/admin/query";
import { requireAdmin } from "@/lib/admin/guard";
import type { SearchParams } from "@/lib/admin/table";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.reports" });
  return { title: t("title") };
}

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

type Tr = (key: string, values?: Record<string, string | number>) => string;

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const [t, ts, tr] = await Promise.all([
    getTranslations("admin.reports"),
    getTranslations("admin.status"),
    getTranslations("admin.reasons"),
  ]);
  const tt = t as unknown as Tr;
  const status = (k: string) => statusText(ts as unknown as StatusTranslator, k);
  const reasonName = (k: string) => ((tr as unknown as StatusTranslator).has(k) ? tr(k as never) : k);
  /** Ready-made reasons. The admin can edit the text before saving. Owners read them, so they follow the admin's language. */
  const templates = (group: "dismiss" | "hold" | "hide" | "remove") =>
    ["1", "2", "3"].filter((n) => t.has(`tpl.${group}.${n}`)).map((n) => tt(`tpl.${group}.${n}`));

  const mine = sp.mine === "1";
  const reviewDays = (await getSettings()).hold_review_days.value;
  const { rows, total, params } = await queryView<Row>("admin_reports_v", sp, {
    sortable: ["created_at", "project_title", "reason", "status"],
    defaultSort: "created_at",
    searchCols: ["project_title", "details"],
    eq: { status: "status", reason: "reason" },
    apply: (q) => (mine ? q.eq("handled_by", me.id) : q),
  });

  function sla(r: Row) {
    if (r.status === "resolved" || r.status === "dismissed")
      return <span className="text-text-2">{t("slaClosed")}</span>;
    const s = slaFor(r.created_at, reviewDays);
    if (s.state === "overdue")
      return <StatusPill tone="danger">{t("slaOverdue", { days: Math.abs(s.days) || 1 })}</StatusPill>;
    return (
      <StatusPill tone={s.state === "soon" ? "warn" : "neutral"}>
        {s.state === "soon" ? t("slaToday") : t("slaIn", { days: s.days })}
      </StatusPill>
    );
  }

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
        <aside aria-label={t("panelLabel")} className="mb-6 rounded-3xl border-2 border-blue bg-white p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <h2 className="m-0 text-lg">{t("panelTitle", { project: report.project_title })}</h2>
            <Link href="/admin/reports" className="text-sm" aria-label={t("closePanel")}>
              {t("close")}
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Panel title={t("theReport")}>
                <KeyValueList
                  items={[
                    { label: t("reason"), value: <StatusPill tone="warn">{reasonName(report.reason)}</StatusPill> },
                    {
                      label: t("status"),
                      value: <StatusPill tone={toneFor(report.status)}>{status(report.status)}</StatusPill>,
                    },
                    { label: t("details"), value: report.details || "—" },
                    { label: t("contact"), value: report.reporter_contact || t("noContact") },
                    { label: t("received"), value: <Time iso={report.created_at} /> },
                    ...(report.resolution_note ? [{ label: t("resolution"), value: report.resolution_note }] : []),
                  ]}
                />
              </Panel>
              <Panel title={t("earlier", { count: (prior ?? []).length })}>
                {(prior ?? []).length === 0 ? (
                  <p className="m-0 text-sm text-text-2">{t("none")}</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                    {(prior as { id: string; reason: string; status: string; created_at: string }[]).map((p) => (
                      <li key={p.id}>
                        <Link href={`/admin/reports?open=${p.id}`}>{reasonName(p.reason)}</Link> · {status(p.status)} ·{" "}
                        <Time iso={p.created_at} className="inline" />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
            <div className="flex flex-col gap-3">
              <Panel title={t("project")}>
                <KeyValueList
                  items={[
                    {
                      label: t("moderation"),
                      value: (
                        <StatusPill tone={toneFor(report.moderation_status)}>
                          {status(report.moderation_status)}
                        </StatusPill>
                      ),
                    },
                    { label: t("owners"), value: d?.creators.map((c) => c.name).join(", ") || "—" },
                    { label: t("teaserSummary"), value: d?.project.summary || "—" },
                  ]}
                />
                <p className="mb-0 mt-3 text-sm">
                  <Link href={`/admin/projects/${report.project_id}`}>{t("openProject")}</Link>
                </p>
              </Panel>
              <Panel title={t("internalNote")}>
                <NoteForm targetType="project" targetId={report.project_id} />
              </Panel>
              <Panel title={t("decision")}>
                {closed ? (
                  <p className="m-0 text-sm text-text-2">{t("closed")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <ReasonAction
                      label={t("dismiss")}
                      reasonLabel={t("noteAudit")}
                      templates={templates("dismiss")}
                      consequence={t("dismissEffect")}
                      action={handleReport.bind(null, openId, "dismiss")}
                    />
                    {report.status === "open" ? (
                      <ReasonAction
                        label={t("markReview")}
                        reasonLabel={t("noteReview")}
                        consequence={t("reviewEffect")}
                        action={handleReport.bind(null, openId, "in_review")}
                      />
                    ) : null}
                    <ReasonAction
                      label={t("hold")}
                      reasonLabel={t("whyHold")}
                      templates={templates("hold")}
                      consequence={t("holdEffect")}
                      action={handleReport.bind(null, report.id, "hold")}
                      successMessage={t("held")}
                    />
                    <ReasonAction
                      label={t("hide")}
                      consequence={t("hideEffect")}
                      action={handleReport.bind(null, openId, "hide")}
                      reasonLabel={t("noteOwners")}
                      templates={templates("hide")}
                    />
                    <ReasonAction
                      label={t("remove")}
                      tone="danger"
                      consequence={t("removeEffect")}
                      action={handleReport.bind(null, openId, "remove")}
                      reasonLabel={t("noteOwners")}
                      templates={templates("remove")}
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
      label: t("colReported"),
      sortable: true,
      render: (r) => <Time iso={r.created_at} className="text-ink" />,
    },
    { key: "project_title", label: t("colProject"), sortable: true, render: (r) => r.project_title },
    { key: "reason", label: t("colReason"), sortable: true, render: (r) => reasonName(r.reason) },
    {
      key: "status",
      label: t("colStatus"),
      sortable: true,
      render: (r) => <StatusPill tone={toneFor(r.status)}>{status(r.status)}</StatusPill>,
    },
    { key: "sla", label: t("colSla", { days: reviewDays }), render: (r) => sla(r) },
    { key: "handler_name", label: t("colHandler"), render: (r) => r.handler_name ?? "—" },
  ];
  const openSpam = rows.filter((r) => r.reason === "spam" && (r.status === "open" || r.status === "in_review"));

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      {panel}
      {openSpam.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-4 text-sm">
          <span>{t("spamNotice", { count: openSpam.length })}</span>
          <ReasonAction
            small
            label={t("spamDismiss", { count: openSpam.length })}
            consequence={t("spamEffect")}
            reasonLabel={t("noteAudit")}
            templates={templates("dismiss")}
            action={bulkDismissSpam.bind(
              null,
              openSpam.slice(0, 50).map((r) => r.id),
            )}
            successMessage={t("spamDone")}
          />
        </div>
      ) : null}
      <FilterBar
        searchLabel={t("search")}
        toggles={[{ key: "mine", label: t("assignedToMe") }]}
        filters={[
          {
            key: "status",
            label: t("filterStatus"),
            options: ["open", "in_review", "resolved", "dismissed"].map((v) => ({ value: v, label: status(v) })),
          },
          {
            key: "reason",
            label: t("filterReason"),
            options: REASONS.map((v) => ({ value: v, label: reasonName(v) })),
          },
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
        caption={t("caption")}
        selectedId={openId}
        empty={{ title: t("emptyTitle"), text: t("emptyText") }}
      />
    </>
  );
}
