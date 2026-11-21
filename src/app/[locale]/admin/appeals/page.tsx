import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { ReasonAction } from "@/components/admin/ReasonDialog";
import { KeyValueList, PageHeader, Panel, StatusPill, Time, toneFor } from "@/components/admin/ui";
import { resolveAppeal } from "@/app/[locale]/admin/actions";
import { queryView } from "@/lib/admin/query";
import { requireAdmin } from "@/lib/admin/guard";
import type { SearchParams } from "@/lib/admin/table";

export const metadata: Metadata = { title: "Appeals" };

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
      label: "Sent",
      sortable: true,
      render: (r) => <Time iso={r.created_at} className="text-ink" />,
    },
    { key: "project_title", label: "Project", sortable: true, render: (r) => r.project_title },
    { key: "decision_action", label: "Decision appealed", render: (r) => r.decision_action },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (r) => <StatusPill tone={toneFor(r.status)}>{r.status}</StatusPill>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Appeals"
        intro="Owners can appeal each moderation decision once. Accepting an appeal restores the project. Every outcome needs a written note, which the owners receive."
      />
      {current ? (
        <aside aria-label="Appeal details" className="mb-6 rounded-3xl border-2 border-blue bg-white p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <h2 className="m-0 text-lg">Appeal about {current.project_title}</h2>
            <Link href="/admin/appeals" className="text-sm" aria-label="Close the appeal panel">
              Close
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="The decision">
              <KeyValueList
                items={[
                  { label: "Decision", value: current.decision_action },
                  {
                    label: "Made by",
                    value: current.decision_automatic ? "Automatic hold (several reporters)" : "An admin",
                  },
                  { label: "Reason given", value: current.decision_reason || "—" },
                  {
                    label: "Project now",
                    value: (
                      <StatusPill tone={toneFor(current.moderation_status)}>{current.moderation_status}</StatusPill>
                    ),
                  },
                ]}
              />
              <p className="mb-0 mt-3 text-sm">
                <Link href={`/admin/projects/${current.project_id}`}>Open the project page</Link>
              </p>
            </Panel>
            <Panel title="The appeal">
              <KeyValueList
                items={[
                  { label: "From", value: current.appellant_name },
                  { label: "Sent", value: <Time iso={current.created_at} /> },
                  { label: "Appeal", value: current.body },
                  ...(current.resolution_note ? [{ label: "Outcome note", value: current.resolution_note }] : []),
                ]}
              />
              {current.status === "open" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <ReasonAction
                    label="Accept and restore"
                    reasonLabel="Note to the owners (kept in the audit log)"
                    consequence={<>The project returns to public pages and the owners are told your note.</>}
                    action={resolveAppeal.bind(null, current.id, "accepted")}
                    successMessage="Appeal accepted. The project was restored."
                  />
                  <ReasonAction
                    label="Reject"
                    reasonLabel="Note to the owners (kept in the audit log)"
                    consequence={<>The decision stands. The owners are told your note. They cannot appeal again.</>}
                    action={resolveAppeal.bind(null, current.id, "rejected")}
                    successMessage="Appeal rejected."
                  />
                </div>
              ) : (
                <p className="mb-0 mt-3 text-sm text-text-2">This appeal is closed.</p>
              )}
            </Panel>
          </div>
        </aside>
      ) : null}
      <FilterBar
        searchLabel="Search project or appeal text"
        filters={[
          {
            key: "status",
            label: "Status",
            options: ["open", "accepted", "rejected"].map((v) => ({ value: v, label: v })),
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
        caption="Appeals against moderation decisions"
        selectedId={openId}
        empty={{ title: "No appeals", text: "Nobody has appealed a decision, or a filter hides it." }}
      />
    </>
  );
}
