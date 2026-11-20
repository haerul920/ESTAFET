import type { Metadata } from "next";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { ConsentActions } from "@/components/admin/ConsentActions";
import { PageHeader, StatusPill, Time, toneFor } from "@/components/admin/ui";
import { queryView } from "@/lib/admin/query";
import type { SearchParams } from "@/lib/admin/table";

export const metadata: Metadata = { title: "Consents" };

interface Row { id: string; project_id: string; project_title: string; advisor_name: string; status: string; expires_at: string; created_at: string; expired: boolean; age_days: number; is_demo: boolean }

export default async function AdminConsentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const state = typeof sp.state === "string" ? sp.state : "";
  const { rows, total, params } = await queryView<Row>("admin_consents_v", sp, {
    sortable: ["created_at", "expires_at", "project_title", "status"],
    defaultSort: "created_at",
    searchCols: ["project_title", "advisor_name"],
    demoCol: "is_demo",
    apply: (q) =>
      state === "expired" ? q.eq("expired", true) : state === "pending" ? q.eq("status", "pending").eq("expired", false) : state === "declined" ? q.eq("status", "declined") : q,
  });

  const columns: Column<Row>[] = [
    { key: "project_title", label: "Project", sortable: true },
    { key: "advisor_name", label: "Advisor" },
    { key: "status", label: "Status", sortable: true, render: (r) => (r.expired ? <StatusPill tone="danger">expired</StatusPill> : <StatusPill tone={toneFor(r.status)}>{r.status}</StatusPill>) },
    { key: "expires_at", label: "Expires", sortable: true, render: (r) => <Time iso={r.expires_at} /> },
    { key: "age_days", label: "Age", render: (r) => `${r.age_days} d` },
    {
      key: "actions",
      label: "Actions",
      render: (r) =>
        r.status === "pending" || r.status === "declined" || r.status === "withdrawn" || r.expired ? (
          <ConsentActions projectId={r.project_id} projectTitle={r.project_title} advisorName={r.advisor_name} />
        ) : (
          <span className="text-text-2">Approved</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Advisor consents" intro="Tokens are never stored or shown. Regenerating a link creates a new one and invalidates the old one." />
      <FilterBar
        searchLabel="Search project or advisor"
        toggles={[{ key: "demo", label: "Include demo data" }]}
        filters={[{ key: "state", label: "Show", options: [{ value: "pending", label: "pending" }, { value: "expired", label: "expired" }, { value: "declined", label: "declined" }] }]}
      />
      <DataTable columns={columns} rows={rows} total={total} params={params} sp={sp} basePath="/admin/consents" caption="Advisor consents" empty={{ title: "No consents match", text: "Demo data is hidden unless you include it." }} />
    </>
  );
}
