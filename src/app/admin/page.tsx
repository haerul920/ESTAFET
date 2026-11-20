import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Panel, StatCard, StatusPill, Time, toneFor, EmptyState } from "@/components/admin/ui";
import { FilterBar } from "@/components/admin/FilterBar";
import { getSettings } from "@/lib/settings";
import { environmentName } from "@/lib/admin/env";

export const metadata: Metadata = { title: "Overview" };

interface Overview {
  open_reports: number;
  hidden_projects: number;
  failed_runs_24h: number;
  expired_consents: number;
  stale_requests: number;
  projects_by_status: Record<string, number>;
  requests_by_status: Record<string, number>;
  users_total: number;
  users_suspended: number;
  demo_projects: number;
}
interface AuditRow { id: string; actor_name: string; action: string; target_type: string; reason: string | null; created_at: string }

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams;
  const includeDemo = demo === "1";
  const supabase = await createClient();
  const [{ data }, { data: audit }, settings] = await Promise.all([
    supabase.rpc("admin_overview", { p_include_demo: includeDemo }),
    supabase.from("admin_audit_v").select("id, actor_name, action, target_type, reason, created_at").order("created_at", { ascending: false }).limit(10),
    getSettings(),
  ]);
  const o = data as Overview;
  const demoQuery = includeDemo ? "?demo=1" : "";
  const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader title="Overview" intro="Queues that need a person, and the key numbers." />
      <FilterBar searchLabel={null} toggles={[{ key: "demo", label: `Include demo data (${o.demo_projects} demo projects)` }]} />
      {!includeDemo && o.demo_projects > 0 ? (
        <p className="mb-4 mt-0 rounded-2xl bg-warn-bg px-4 py-2.5 text-sm text-warn-ink">Showing real data only. {o.demo_projects} demo projects are hidden from these numbers.</p>
      ) : null}

      <h2 className="mono-label mb-2 mt-0 text-xs font-normal text-text-2">Queues</h2>
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <StatCard label="Open reports" value={o.open_reports} href="/admin/reports?status=open" tone={o.open_reports ? "warn" : "grey"} />
        <StatCard label="Hidden or removed" value={o.hidden_projects} href="/admin/projects?moderation=hidden" tone={o.hidden_projects ? "warn" : "grey"} />
        <StatCard label="Failed runs, 24 h" value={o.failed_runs_24h} href="/admin/pipeline?status=failed" tone={o.failed_runs_24h ? "danger" : "grey"} />
        <StatCard label="Expired advisor consents" value={o.expired_consents} href="/admin/consents?state=expired" tone={o.expired_consents ? "warn" : "grey"} />
        <StatCard label="Requests pending 7+ days" value={o.stale_requests} href="/admin/requests?state=stale" tone={o.stale_requests ? "warn" : "grey"} />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Panel title={`Projects by status (${sum(o.projects_by_status)})`}>
          {Object.keys(o.projects_by_status).length === 0 ? <p className="m-0 text-sm text-text-2">No projects.</p> : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
              {Object.entries(o.projects_by_status).map(([k, n]) => (
                <li key={k} className="flex items-center justify-between"><StatusPill tone={toneFor(k)}>{k.replace("_", " ")}</StatusPill><strong>{n}</strong></li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={`Requests by status (${sum(o.requests_by_status)})`}>
          {Object.keys(o.requests_by_status).length === 0 ? <p className="m-0 text-sm text-text-2">No requests.</p> : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
              {Object.entries(o.requests_by_status).map(([k, n]) => (
                <li key={k} className="flex items-center justify-between"><StatusPill tone={toneFor(k)}>{k}</StatusPill><strong>{n}</strong></li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="People and platform">
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
            <li className="flex justify-between"><span>Users</span><strong>{o.users_total}</strong></li>
            <li className="flex justify-between"><span>Suspended users</span><strong>{o.users_suspended}</strong></li>
            <li className="flex justify-between"><span>Environment</span><strong>{environmentName()}</strong></li>
            <li className="flex justify-between"><span>Registrations</span><strong>{settings.registrations_open.value ? "open" : "closed"}</strong></li>
          </ul>
        </Panel>
      </div>

      <Panel title="Recent audit events" action={<Link href="/admin/audit" className="text-sm">View all</Link>}>
        {(audit ?? []).length === 0 ? (
          <EmptyState title="No audit events yet" text="Every admin action will appear here." />
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
            {(audit as AuditRow[]).map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                <span><strong>{a.actor_name}</strong> <code className="font-code text-[13px]">{a.action}</code> <span className="text-text-2">{a.target_type}</span>{a.reason ? <span className="block text-text-2">“{a.reason}”</span> : null}</span>
                <Time iso={a.created_at} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <span className="sr-only">{demoQuery}</span>
    </>
  );
}
