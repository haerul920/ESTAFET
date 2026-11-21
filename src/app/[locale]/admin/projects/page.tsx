import type { Metadata } from "next";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader, StatusPill, Time, toneFor } from "@/components/admin/ui";
import { DemoBadge } from "@/components/ui/Badge";
import { queryView } from "@/lib/admin/query";
import type { SearchParams } from "@/lib/admin/table";
import { FACULTIES } from "@/lib/labels";

export const metadata: Metadata = { title: "Projects" };

interface Row {
  id: string; title: string; slug: string; creators: string; status: string; moderation_status: string; is_demo: boolean;
  updated_at: string; open_reports: number; field: string;
}

export default async function AdminProjectsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { rows, total, params } = await queryView<Row>("admin_projects_v", sp, {
    sortable: ["title", "status", "moderation_status", "updated_at", "open_reports"],
    defaultSort: "updated_at",
    searchCols: ["title", "slug", "creators"],
    eq: { status: "status", moderation: "moderation_status", field: "field" },
    demoCol: "is_demo",
  });

  const columns: Column<Row>[] = [
    { key: "title", label: "Title", sortable: true },
    { key: "creators", label: "Owners", render: (r) => r.creators || "—" },
    { key: "status", label: "Status", sortable: true, render: (r) => <StatusPill tone={toneFor(r.status)}>{r.status.replace("_", " ")}</StatusPill> },
    { key: "moderation_status", label: "Moderation", sortable: true, render: (r) => <StatusPill tone={toneFor(r.moderation_status)}>{r.moderation_status}</StatusPill> },
    { key: "is_demo", label: "Demo", render: (r) => (r.is_demo ? <DemoBadge /> : "—") },
    { key: "updated_at", label: "Updated", sortable: true, render: (r) => <Time iso={r.updated_at} /> },
    { key: "open_reports", label: "Open reports", sortable: true, render: (r) => (r.open_reports ? <StatusPill tone="warn">{r.open_reports}</StatusPill> : "0") },
  ];

  return (
    <>
      <PageHeader title="Projects" intro="Lifecycle status and moderation status are separate. Public pages need published AND moderation ok." />
      <FilterBar
        searchLabel="Search title, slug or owner"
        toggles={[{ key: "demo", label: "Include demo projects" }]}
        filters={[
          { key: "status", label: "Status", options: ["draft", "published", "unpublished", "archived"].map((v) => ({ value: v, label: v.replace("_", " ") })) },
          { key: "moderation", label: "Moderation", options: ["ok", "hidden", "removed"].map((v) => ({ value: v, label: v })) },
          { key: "field", label: "Field", options: FACULTIES.slice(0, 4).map((v) => ({ value: v, label: v })) },
        ]}
      />
      <DataTable columns={columns} rows={rows} total={total} params={params} sp={sp} basePath="/admin/projects" rowHref={(r) => `/admin/projects/${r.id}`} caption="Projects" empty={{ title: "No projects match", text: "Demo projects are hidden unless you include them." }} />
    </>
  );
}
