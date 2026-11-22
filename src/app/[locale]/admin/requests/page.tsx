import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { NoteForm } from "@/components/admin/NoteForm";
import { KeyValueList, PageHeader, Panel, StatusPill, Time, Timeline, toneFor } from "@/components/admin/ui";
import { queryView } from "@/lib/admin/query";
import type { SearchParams } from "@/lib/admin/table";
import { formatDate } from "@/lib/format";
import { getLabels } from "@/lib/get-labels";
import { statusText, type StatusTranslator } from "@/lib/admin/labels";
import type { RequestPurpose } from "@/lib/db/types";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.requests" });
  return { title: t("title") };
}

interface Row {
  id: string;
  project_id: string;
  project_title: string;
  adopter_team_name: string;
  status: string;
  created_at: string;
  last_change: string;
  stale: boolean;
  waiting_agreement: boolean;
  unlocked: boolean;
  is_demo: boolean;
  plan: string;
  purpose: RequestPurpose;
  target_date: string | null;
  fit_note: string;
  decision_note: string | null;
  team_size: number;
}

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [locale, t, ts, L] = await Promise.all([
    getLocale(),
    getTranslations("admin.requests"),
    getTranslations("admin.status"),
    getLabels(),
  ]);
  const status = (k: string) => statusText(ts as unknown as StatusTranslator, k);
  const state = typeof sp.state === "string" ? sp.state : "";
  const { rows, total, params } = await queryView<Row>("admin_requests_v", sp, {
    sortable: ["created_at", "last_change", "project_title", "status"],
    defaultSort: "created_at",
    searchCols: ["project_title", "adopter_team_name"],
    eq: { status: "status" },
    demoCol: "is_demo",
    apply: (q) => (state === "stale" ? q.eq("stale", true) : state === "waiting" ? q.eq("waiting_agreement", true) : q),
  });

  const openId = typeof sp.open === "string" ? sp.open : null;
  const supabase = await createClient();
  const open = openId
    ? ((await supabase.from("admin_requests_v").select("*").eq("id", openId).maybeSingle()).data as Row | null)
    : null;
  const notes = open
    ? (((
        await supabase
          .from("admin_audit_v")
          .select("id, actor_name, reason, created_at")
          .eq("target_type", "request")
          .eq("target_id", open.id)
          .eq("action", "note.add")
          .order("created_at", { ascending: false })
      ).data ?? []) as { id: string; actor_name: string; reason: string; created_at: string }[])
    : [];

  const columns: Column<Row>[] = [
    { key: "project_title", label: t("colProject"), sortable: true },
    { key: "adopter_team_name", label: t("colTeam") },
    {
      key: "status",
      label: t("colStatus"),
      sortable: true,
      render: (r) => (
        <span className="flex flex-wrap gap-1.5">
          <StatusPill tone={toneFor(r.status)}>{status(r.status)}</StatusPill>
          {r.stale ? <StatusPill tone="danger">{t("stale")}</StatusPill> : null}
          {r.waiting_agreement ? <StatusPill tone="warn">{t("waiting")}</StatusPill> : null}
          {r.unlocked ? <StatusPill tone="ok">{t("unlocked")}</StatusPill> : null}
        </span>
      ),
    },
    { key: "created_at", label: t("colCreated"), sortable: true, render: (r) => <Time iso={r.created_at} /> },
    { key: "last_change", label: t("colLastChange"), sortable: true, render: (r) => <Time iso={r.last_change} /> },
  ];

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      {open ? (
        <aside aria-label={t("panelLabel")} className="mb-5 rounded-3xl border-2 border-blue bg-white p-5">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <h2 className="m-0 text-lg">
              {open.adopter_team_name} → {open.project_title}
            </h2>
            <Link href="/admin/requests" className="text-sm">
              {t("close")}
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title={t("request")}>
              <KeyValueList
                items={[
                  {
                    label: t("colStatus"),
                    value: <StatusPill tone={toneFor(open.status)}>{status(open.status)}</StatusPill>,
                  },
                  { label: t("teamSize"), value: open.team_size },
                  { label: t("purpose"), value: L.purpose[open.purpose] },
                  { label: t("targetDate"), value: open.target_date ? formatDate(open.target_date, locale) : "—" },
                  { label: t("plan"), value: open.plan },
                  { label: t("fit"), value: open.fit_note || "—" },
                  { label: t("ownersSaid"), value: open.decision_note || "—" },
                ]}
              />
            </Panel>
            <div className="flex flex-col gap-3">
              <Panel title={t("adminNotes")}>
                <Timeline
                  items={notes.map((n) => ({ id: n.id, title: n.actor_name, sub: n.reason, when: n.created_at }))}
                />
                <div className="mt-3">
                  <NoteForm targetType="request" targetId={open.id} />
                </div>
              </Panel>
              <p className="m-0 text-sm">
                <Link href={`/admin/projects/${open.project_id}`}>{t("openProject")}</Link>
              </p>
            </div>
          </div>
        </aside>
      ) : null}
      <FilterBar
        searchLabel={t("search")}
        toggles={[{ key: "demo", label: t("includeDemo") }]}
        filters={[
          {
            key: "status",
            label: t("colStatus"),
            options: ["pending", "approved", "declined", "withdrawn"].map((v) => ({ value: v, label: status(v) })),
          },
          {
            key: "state",
            label: t("needsAttention"),
            options: [
              { value: "stale", label: t("stale") },
              { value: "waiting", label: t("waitingFull") },
            ],
          },
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        params={params}
        sp={sp}
        basePath="/admin/requests"
        rowHref={(r) => `/admin/requests?open=${r.id}`}
        caption={t("caption")}
        selectedId={openId}
        empty={{ title: t("emptyTitle"), text: t("emptyText") }}
      />
    </>
  );
}
