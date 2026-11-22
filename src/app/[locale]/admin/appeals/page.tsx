import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { ReasonAction } from "@/components/admin/ReasonDialog";
import { KeyValueList, PageHeader, Panel, StatusPill, Time, toneFor } from "@/components/admin/ui";
import { resolveAppeal } from "@/app/[locale]/admin/actions";
import { statusText, type StatusTranslator } from "@/lib/admin/labels";
import { queryView } from "@/lib/admin/query";
import { requireAdmin } from "@/lib/admin/guard";
import type { SearchParams } from "@/lib/admin/table";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.appeals" });
  return { title: t("title") };
}

interface Row {
  id: string;
  project_id: string;
  project_title: string;
  project_slug: string;
  moderation_status: string;
  decision_action: string;
  decision_reason: string;
  decision_automatic: boolean;
  appellant_name: string;
  body: string;
  status: string;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

/** Appeals against moderation decisions. One appeal per decision. Accepting an appeal restores the project. */
export default async function AdminAppealsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  await requireAdmin();
  const [t, ts, ta] = await Promise.all([
    getTranslations("admin.appeals"),
    getTranslations("admin.status"),
    getTranslations("admin.actionsName"),
  ]);
  const status = (k: string) => statusText(ts as unknown as StatusTranslator, k);
  const action = (k: string) => ((ta as unknown as StatusTranslator).has(k) ? ta(k as never) : k);

  const { rows, total, params } = await queryView<Row>("admin_appeals_v", sp, {
    sortable: ["created_at", "project_title", "status"],
    defaultSort: "created_at",
    defaultDir: "asc",
    searchCols: ["project_title", "body"],
    eq: { status: "status" },
  });

  const openId = typeof sp.open === "string" ? sp.open : null;
  const current = openId ? rows.find((r) => r.id === openId) : undefined;

  const columns: Column<Row>[] = [
    {
      key: "created_at",
      label: t("colSent"),
      sortable: true,
      render: (r) => <Time iso={r.created_at} className="text-ink" />,
    },
    { key: "project_title", label: t("colProject"), sortable: true, render: (r) => r.project_title },
    { key: "decision_action", label: t("colDecision"), render: (r) => action(r.decision_action) },
    {
      key: "status",
      label: t("colStatus"),
      sortable: true,
      render: (r) => <StatusPill tone={toneFor(r.status)}>{status(r.status)}</StatusPill>,
    },
  ];

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      {current ? (
        <aside aria-label={t("panelLabel")} className="mb-6 rounded-3xl border-2 border-blue bg-white p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <h2 className="m-0 text-lg">{t("panelTitle", { project: current.project_title })}</h2>
            <Link href="/admin/appeals" className="text-sm" aria-label={t("closePanel")}>
              {t("close")}
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title={t("theDecision")}>
              <KeyValueList
                items={[
                  { label: t("decision"), value: action(current.decision_action) },
                  {
                    label: t("madeBy"),
                    value: current.decision_automatic ? t("auto") : t("byAdmin"),
                  },
                  { label: t("reasonGiven"), value: current.decision_reason || "—" },
                  {
                    label: t("projectNow"),
                    value: (
                      <StatusPill tone={toneFor(current.moderation_status)}>
                        {status(current.moderation_status)}
                      </StatusPill>
                    ),
                  },
                ]}
              />
              <p className="mb-0 mt-3 text-sm">
                <Link href={`/admin/projects/${current.project_id}`}>{t("openProject")}</Link>
              </p>
            </Panel>
            <Panel title={t("theAppeal")}>
              <KeyValueList
                items={[
                  { label: t("from"), value: current.appellant_name },
                  { label: t("sent"), value: <Time iso={current.created_at} /> },
                  { label: t("appeal"), value: current.body },
                  ...(current.resolution_note ? [{ label: t("outcomeNote"), value: current.resolution_note }] : []),
                ]}
              />
              {current.status === "open" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <ReasonAction
                    label={t("accept")}
                    reasonLabel={t("noteLabel")}
                    consequence={t("acceptEffect")}
                    action={resolveAppeal.bind(null, current.id, "accepted")}
                    successMessage={t("accepted")}
                  />
                  <ReasonAction
                    label={t("reject")}
                    reasonLabel={t("noteLabel")}
                    consequence={t("rejectEffect")}
                    action={resolveAppeal.bind(null, current.id, "rejected")}
                    successMessage={t("rejected")}
                  />
                </div>
              ) : (
                <p className="mb-0 mt-3 text-sm text-text-2">{t("isClosed")}</p>
              )}
            </Panel>
          </div>
        </aside>
      ) : null}
      <FilterBar
        searchLabel={t("search")}
        filters={[
          {
            key: "status",
            label: t("filterStatus"),
            options: ["open", "accepted", "rejected"].map((v) => ({ value: v, label: status(v) })),
          },
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        params={params}
        sp={sp}
        basePath="/admin/appeals"
        rowHref={(r) => `/admin/appeals?open=${r.id}`}
        caption={t("caption")}
        selectedId={openId}
        empty={{ title: t("emptyTitle"), text: t("emptyText") }}
      />
    </>
  );
}
