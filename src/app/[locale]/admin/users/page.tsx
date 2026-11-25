import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader, StatusPill, Time } from "@/components/admin/ui";
import { queryView } from "@/lib/admin/query";
import { requireAdmin } from "@/lib/admin/guard";
import { RoleControl } from "@/components/admin/RoleControl";
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
    // Filtered in the database, so the page count matches the rows.
    apply: (q) => (sp.role === "admin" ? q.eq("is_admin", true) : sp.role === "member" ? q.eq("is_admin", false) : q),
  });
  const me = await requireAdmin();

  const columns: Column<Row>[] = [
    { key: "full_name", label: t("colName"), sortable: true },
    { key: "email", label: t("colEmail"), sortable: true },
    { key: "university", label: t("colUniversity") },
    {
      key: "is_admin",
      label: t("colRole"),
      render: (r) => <RoleControl userId={r.id} name={r.full_name} isAdmin={r.is_admin} self={r.id === me.id} />,
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
        dropdowns
        searchLabel={t("search")}
        filters={[
          {
            key: "role",
            label: t("filterRole"),
            allLabel: t("allRoles"),
            options: [
              { value: "admin", label: t("roleAdmin") },
              { value: "member", label: t("roleMember") },
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
        basePath="/admin/users"
        rowHref={(r) => `/admin/users/${r.id}`}
        caption={t("caption")}
        empty={{ title: t("emptyTitle") }}
      />
    </>
  );
}
