import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { DateRange } from "@/components/admin/DateRange";
import { KeyValueList, PageHeader, Panel, Time } from "@/components/admin/ui";
import { queryView } from "@/lib/admin/query";
import { diffObjects, type AuditEvent } from "@/lib/admin/audit";
import { formatWita } from "@/lib/admin/time";
import { withParams, type SearchParams } from "@/lib/admin/table";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Audit log" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const TARGETS = [
  "project",
  "report",
  "user",
  "setting",
  "synthesis_run",
  "trial_session",
  "file",
  "platform",
  "request",
];

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const from = first(sp.from);
  const to = first(sp.to);
  const actor = first(sp.actor)?.trim();
  const action = first(sp.action)?.trim();
  const { rows, total, params } = await queryView<AuditEvent>("admin_audit_v", sp, {
    sortable: ["created_at", "actor_name", "action", "target_type"],
    defaultSort: "created_at",
    searchCols: ["action", "reason", "actor_name"],
    eq: { target: "target_type" },
    pageSize: 20,
    apply: (q) => {
      let r = q;
      if (actor) r = r.ilike("actor_name", `%${actor.replace(/[%,()]/g, " ")}%`);
      if (action) r = r.ilike("action", `${action.replace(/[%,()]/g, " ")}%`);
      if (from) r = r.gte("created_at", `${from}T00:00:00+08:00`);
      if (to) r = r.lte("created_at", `${to}T23:59:59+08:00`);
      return r;
    },
  });

  const openId = first(sp.open);
  const supabase = await createClient();
  const open = openId
    ? ((await supabase.from("admin_audit_v").select("*").eq("id", openId).maybeSingle()).data as AuditEvent | null)
    : null;

  const exportQs = withParams(sp, { open: undefined, page: undefined, sort: undefined, dir: undefined });

  const columns: Column<AuditEvent>[] = [
    {
      key: "created_at",
      label: "When",
      sortable: true,
      render: (r) => <Time iso={r.created_at} className="text-ink" />,
    },
    { key: "actor_name", label: "Actor", sortable: true },
    {
      key: "action",
      label: "Action",
      sortable: true,
      render: (r) => <code className="font-code text-[13px]">{r.action}</code>,
    },
    {
      key: "target_type",
      label: "Target",
      sortable: true,
      render: (r) => `${r.target_type}${r.target_id ? ` ${r.target_id.slice(0, 8)}` : ""}`,
    },
    {
      key: "reason",
      label: "Reason",
      render: (r) => <span className="line-clamp-2 max-w-[320px] text-text-2">{r.reason ?? "—"}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        intro="Every admin action, with who, what and why."
        actions={
          <a
            href={`/api/admin/audit/export${exportQs}`}
            download
            className="inline-flex min-h-[44px] items-center rounded-full border-[1.5px] border-line-strong bg-white px-5 font-semibold text-ink no-underline hover:bg-surface"
          >
            Export CSV (current filter)
          </a>
        }
      />
      <p className="mb-4 mt-0 flex items-center gap-2 rounded-2xl bg-blue-tint px-4 py-2.5 text-sm text-text-3">
        <Lock size={16} aria-hidden="true" /> This log is append-only. Entries cannot be edited or deleted, by anyone.
      </p>

      {open ? (
        <aside aria-label="Audit entry" className="mb-5 rounded-3xl border-2 border-blue bg-white p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <h2 className="m-0 text-lg">
              <code className="font-code">{open.action}</code>
            </h2>
            <Link href={`/admin/audit${withParams(sp, { open: undefined })}`} className="text-sm">
              Close
            </Link>
          </div>
          <KeyValueList
            items={[
              { label: "Actor", value: open.actor_name },
              { label: "When", value: formatWita(open.created_at) },
              { label: "Target", value: `${open.target_type}${open.target_id ? ` (${open.target_id})` : ""}` },
              { label: "Reason", value: open.reason ?? "—" },
            ]}
          />
          <h3 className="mb-2 mt-4 text-sm">Before and after</h3>
          {open.before || open.after ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-text-2">
                  <th className="py-1 font-semibold">Field</th>
                  <th className="font-semibold">Before</th>
                  <th className="font-semibold">After</th>
                </tr>
              </thead>
              <tbody>
                {diffObjects(open.before, open.after).map((d) => (
                  <tr
                    key={d.key}
                    className={cn(
                      "border-t border-line",
                      d.kind === "changed" && "bg-warn-bg/60",
                      d.kind === "added" && "bg-ok-bg/60",
                      d.kind === "removed" && "bg-[#fdecea]/70",
                    )}
                  >
                    <td className="py-1.5 pr-3 font-code text-[13px]">{d.key}</td>
                    <td className="pr-3">{d.before || "—"}</td>
                    <td>{d.after || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="m-0 text-sm text-text-2">This action recorded no before or after values.</p>
          )}
        </aside>
      ) : null}

      <FilterBar
        searchLabel="Search action, reason or actor"
        filters={[
          {
            key: "target",
            label: "Target type",
            options: TARGETS.map((t) => ({ value: t, label: t.replace("_", " ") })),
          },
        ]}
      />
      <AuditTextFilters actor={actor} action={action} />
      <DateRange from={from} to={to} />
      <Panel className="p-0">
        <span className="sr-only">Results below</span>
      </Panel>
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        params={params}
        sp={sp}
        basePath="/admin/audit"
        rowHref={(r) => `/admin/audit${withParams(sp, { open: r.id })}`}
        caption="Audit events"
        selectedId={openId}
        empty={{ title: "No audit events match", text: "Clear a filter or widen the date range." }}
      />
    </>
  );
}

/** Plain GET form so actor and action filters work without client JS. */
function AuditTextFilters({ actor, action }: { actor?: string; action?: string }) {
  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
      <label className="flex flex-col gap-1">
        Actor
        <input
          name="actor"
          defaultValue={actor}
          className="min-h-[40px] rounded-xl border border-line-strong bg-white px-3"
        />
      </label>
      <label className="flex flex-col gap-1">
        Action starts with
        <input
          name="action"
          defaultValue={action}
          placeholder="project."
          className="min-h-[40px] rounded-xl border border-line-strong bg-white px-3"
        />
      </label>
      <button
        type="submit"
        className="min-h-[40px] cursor-pointer rounded-full border-[1.5px] border-line-strong bg-white px-4 font-semibold hover:bg-surface"
      >
        Apply
      </button>
    </form>
  );
}
