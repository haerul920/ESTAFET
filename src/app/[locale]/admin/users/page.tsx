import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader, StatusPill, Time } from "@/components/admin/ui";
import { queryView } from "@/lib/admin/query";
import type { SearchParams } from "@/lib/admin/table";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.users" });
  return { title: t("title") };
}

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
  const t = await getTranslations("admin.users");
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
    { key: "full_name", label: t("colName"), sortable: true },
    { key: "email", label: t("colEmail"), sortable: true },
    { key: "university", label: t("colUniversity") },
    {
      key: "is_admin",
      label: t("colRole"),
      render: (r) => (r.is_admin ? <StatusPill tone="info">{t("admin")}</StatusPill> : t("member")),
    },
    { key: "projects_count", label: t("colProjects"), sortable: true },
    {
      key: "last_sign_in_at",
      label: t("colLastActive"),
      sortable: true,
      render: (r) => <Time iso={r.last_sign_in_at} />,
    },
    {
      key: "suspended",
      label: t("colStatus"),
      render: (r) =>
        r.suspended ? (
          <StatusPill tone="danger">{t("suspended")}</StatusPill>
        ) : (
          <StatusPill tone="ok">{t("active")}</StatusPill>
        ),
    },
  ];

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <FilterBar
        searchLabel={t("search")}
        filters={[
          {
            key: "status",
            label: t("filterStatus"),
            options: [
              { value: "active", label: t("active") },
              { value: "suspended", label: t("suspended") },
            ],
          },
          { key: "role", label: t("filterRole"), options: [{ value: "admin", label: t("admins") }] },
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
        caption={t("caption")}
        empty={{ title: t("emptyTitle") }}
      />
    </>
  );
}
