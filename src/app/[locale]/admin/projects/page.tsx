import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader, StatusPill, Time, toneFor } from "@/components/admin/ui";
import { DemoBadge } from "@/components/ui/Badge";
import { queryView } from "@/lib/admin/query";
import { statusText, type StatusTranslator } from "@/lib/admin/labels";
import type { SearchParams } from "@/lib/admin/table";
import { FACULTIES } from "@/lib/labels";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.projects" });
  return { title: t("title") };
}

interface Row {
  id: string;
  title: string;
  slug: string;
  creators: string;
  status: string;
  moderation_status: string;
  is_demo: boolean;
  updated_at: string;
  open_reports: number;
  field: string;
}

export default async function AdminProjectsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [t, ts] = await Promise.all([getTranslations("admin.projects"), getTranslations("admin.status")]);
  const status = (k: string) => statusText(ts as unknown as StatusTranslator, k);
  const { rows, total, params } = await queryView<Row>("admin_projects_v", sp, {
    sortable: ["title", "status", "moderation_status", "updated_at", "open_reports"],
    defaultSort: "updated_at",
    searchCols: ["title", "slug", "creators"],
    eq: { status: "status", moderation: "moderation_status", field: "field" },
    demoCol: "is_demo",
  });

  const columns: Column<Row>[] = [
    { key: "title", label: t("colTitle"), sortable: true },
    { key: "creators", label: t("colOwners"), render: (r) => r.creators || "—" },
    {
      key: "status",
      label: t("colStatus"),
      sortable: true,
      render: (r) => <StatusPill tone={toneFor(r.status)}>{status(r.status)}</StatusPill>,
    },
    {
      key: "moderation_status",
      label: t("colModeration"),
      sortable: true,
      render: (r) => <StatusPill tone={toneFor(r.moderation_status)}>{status(r.moderation_status)}</StatusPill>,
    },
    { key: "is_demo", label: t("colDemo"), render: (r) => (r.is_demo ? <DemoBadge /> : "—") },
    { key: "updated_at", label: t("colUpdated"), sortable: true, render: (r) => <Time iso={r.updated_at} /> },
    {
      key: "open_reports",
      label: t("colReports"),
      sortable: true,
      render: (r) => (r.open_reports ? <StatusPill tone="warn">{r.open_reports}</StatusPill> : "0"),
    },
  ];

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <FilterBar
        searchLabel={t("search")}
        toggles={[{ key: "demo", label: t("includeDemo") }]}
        filters={[
          {
            key: "status",
            label: t("filterStatus"),
            options: ["draft", "published", "unpublished", "archived"].map((v) => ({ value: v, label: status(v) })),
          },
          {
            key: "moderation",
            label: t("filterModeration"),
            options: ["ok", "held", "hidden", "removed"].map((v) => ({ value: v, label: status(v) })),
          },
          {
            key: "field",
            label: t("filterField"),
            options: FACULTIES.slice(0, 4).map((v) => ({ value: v, label: v })),
          },
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        params={params}
        sp={sp}
        basePath="/admin/projects"
        rowHref={(r) => `/admin/projects/${r.id}`}
        caption={t("caption")}
        empty={{ title: t("emptyTitle"), text: t("emptyText") }}
      />
    </>
  );
}
