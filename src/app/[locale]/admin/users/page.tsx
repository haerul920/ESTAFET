import type { Metadata } from "next";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader, StatusPill, Time } from "@/components/admin/ui";
import { queryView } from "@/lib/admin/query";
import type { SearchParams } from "@/lib/admin/table";

export const metadata: Metadata = { title: "Users" };

interface Row {
  id: string;
  full_name: string;
  email: string;
  university: string;
  is_admin: boolean;
  suspended: boolean;
  last_sign_in_at: string | null;
  projects_count: number;
  requests_count: number;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { rows, total, params } = await queryView<Row>("admin_users_v", sp, {
    sortable: ["full_name", "email", "projects_count", "last_sign_in_at", "created_at"],
    defaultSort: "created_at",
    searchCols: ["full_name", "email"],
    apply: (q) =>
      sp.status === "suspended"
        ? q.eq("suspended", true)
        : sp.status === "active"
          ? q.eq("suspended", false)
          : sp.role === "admin"
            ? q
            : q,
  });
  const filtered = sp.role === "admin" ? rows.filter((r) => r.is_admin) : rows;

  const columns: Column<Row>[] = [
    { key: "full_name", label: "Name", sortable: true },
    { key: "email", label: "Email", sortable: true },
    { key: "university", label: "University" },
    {
      key: "is_admin",
      label: "Role",
      render: (r) => (r.is_admin ? <StatusPill tone="info">admin</StatusPill> : "member"),
    },
    { key: "projects_count", label: "Projects", sortable: true },
    { key: "last_sign_in_at", label: "Last active", sortable: true, render: (r) => <Time iso={r.last_sign_in_at} /> },
    {
      key: "suspended",
      label: "Status",
      render: (r) =>
        r.suspended ? <StatusPill tone="danger">suspended</StatusPill> : <StatusPill tone="ok">active</StatusPill>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        intro="Accounts and their status. Admin promotion is not available here: it needs a service-role SQL function."
      />
      <FilterBar
        searchLabel="Search name or email"
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "active", label: "active" },
              { value: "suspended", label: "suspended" },
            ],
          },
          { key: "role", label: "Role", options: [{ value: "admin", label: "admins" }] },
        ]}
      />
      <DataTable
        columns={columns}
        rows={filtered}
        total={sp.role === "admin" ? filtered.length : total}
        params={params}
        sp={sp}
        basePath="/admin/users"
        rowHref={(r) => `/admin/users/${r.id}`}
        caption="Users"
        empty={{ title: "No users match" }}
      />
    </>
  );
}
