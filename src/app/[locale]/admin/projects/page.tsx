import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader, StatusPill, Time, toneFor } from "@/components/admin/ui";
import { queryView } from "@/lib/admin/query";
import { statusText, type StatusTranslator } from "@/lib/admin/labels";
import type { SearchParams } from "@/lib/admin/table";
import { createClient } from "@/lib/supabase/server";

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
  const chosenStatus = typeof sp.status === "string" ? sp.status : "";
  const moderation = typeof sp.moderation === "string" ? sp.moderation : "";
  // "Appeal" is not a moderation state. It lists the projects that have an appeal waiting for a decision.
  const byAppeal = moderation === "appeal";
  let appealed: string[] = [];
  if (byAppeal) {
    const supabase = await createClient();
    const { data } = await supabase.from("admin_appeals_v").select("project_id").eq("status", "open");
    appealed = [...new Set(((data ?? []) as { project_id: string }[]).map((a) => a.project_id))];
  }
  const option = (value: string) => {
    const text = status(value);
    return { value, label: text.charAt(0).toUpperCase() + text.slice(1) };
  };
  // A link from elsewhere (the overview's "held" card) can choose a value the menu does not list. It then shows too.
  const withChosen = (values: string[], chosen: string) =>
    chosen && chosen !== "appeal" && !values.includes(chosen) ? [...values, chosen] : values;
  const { rows, total, params } = await queryView<Row>("admin_projects_v", sp, {
    sortable: ["title", "status", "moderation_status", "updated_at", "open_reports"],
    defaultSort: "updated_at",
    searchCols: ["title", "slug", "creators"],
    eq: byAppeal ? { status: "status" } : { status: "status", moderation: "moderation_status" },
    apply: byAppeal ? (q) => q.in("id", appealed) : undefined,
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
        dropdowns
        searchLabel={t("search")}
        filters={[
          {
            key: "status",
            label: t("filterStatus"),
            allLabel: t("allStatuses"),
            options: withChosen(["draft", "published"], chosenStatus).map(option),
          },
          {
            key: "moderation",
            label: t("filterModeration"),
            allLabel: t("allModeration"),
            options: [
              ...withChosen(["ok", "removed"], moderation).map(option),
              { value: "appeal", label: t("appealOption") },
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
        basePath="/admin/projects"
        rowHref={(r) => `/admin/projects/${r.id}`}
        caption={t("caption")}
        empty={{ title: t("emptyTitle"), text: t("emptyText") }}
      />
    </>
  );
}
