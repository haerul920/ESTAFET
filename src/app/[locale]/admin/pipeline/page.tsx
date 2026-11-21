import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { ReasonAction } from "@/components/admin/ReasonDialog";
import { KeyValueList, PageHeader, Panel, StatCard, StatusPill, Time, toneFor } from "@/components/admin/ui";
import { DateRange } from "@/components/admin/DateRange";
import { cancelRun, retryRun } from "@/app/[locale]/admin/actions";
import { queryView } from "@/lib/admin/query";
import { getConfig } from "@/lib/llm";
import { hoursAgoIso } from "@/lib/admin/time";
import { getSettings } from "@/lib/settings";
import type { SearchParams } from "@/lib/admin/table";

export const metadata: Metadata = { title: "Pipeline" };

interface Row {
  id: string; project_id: string; project_title: string; provider: string; model: string; mode: string; status: string; error: string | null;
  input_hash: string; created_at: string; duration_seconds: number; items_total: number; items_matched: number; items_partial: number; items_not_found: number; is_demo: boolean;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminPipelinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const from = first(sp.from);
  const to = first(sp.to);
  const { rows, total, params } = await queryView<Row>("admin_runs_v", sp, {
    sortable: ["created_at", "project_title", "status", "mode", "duration_seconds"],
    defaultSort: "created_at",
    searchCols: ["project_title", "provider", "model"],
    eq: { status: "status", mode: "mode" },
    apply: (q) => {
      let r = q;
      if (from) r = r.gte("created_at", `${from}T00:00:00+08:00`);
      if (to) r = r.lte("created_at", `${to}T23:59:59+08:00`);
      return r;
    },
  });

  const supabase = await createClient();
  const dayAgo = hoursAgoIso(24);
  const [{ count: today }, { count: failed }, { count: all24 }] = await Promise.all([
    supabase.from("admin_runs_v").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
    supabase.from("admin_runs_v").select("id", { count: "exact", head: true }).gte("created_at", dayAgo).eq("status", "failed"),
    supabase.from("admin_runs_v").select("id", { count: "exact", head: true }).gte("created_at", dayAgo).in("status", ["done", "failed"]),
  ]);
  const cfg = getConfig();
  const cap = (await getSettings()).synthesis_daily_cap.value;
  const rate = all24 ? Math.round(((failed ?? 0) / all24) * 100) : 0;

  const openId = typeof sp.open === "string" ? sp.open : null;
  const open = rows.find((r) => r.id === openId) ?? (openId ? ((await supabase.from("admin_runs_v").select("*").eq("id", openId).maybeSingle()).data as Row | null) : null);

  const columns: Column<Row>[] = [
    { key: "project_title", label: "Project", sortable: true },
    { key: "provider", label: "Provider", render: (r) => r.provider },
    { key: "model", label: "Model", render: (r) => r.model || "—" },
    { key: "mode", label: "Mode", sortable: true, render: (r) => <StatusPill tone={r.mode === "mock" ? "warn" : "info"}>{r.mode}</StatusPill> },
    { key: "status", label: "Status", sortable: true, render: (r) => <StatusPill tone={toneFor(r.status)}>{r.status}</StatusPill> },
    { key: "duration_seconds", label: "Duration", sortable: true, render: (r) => `${r.duration_seconds}s` },
    { key: "error", label: "Error", render: (r) => <span className="line-clamp-2 max-w-[260px] text-text-2">{r.error ?? "—"}</span> },
    { key: "created_at", label: "Started", sortable: true, render: (r) => <Time iso={r.created_at} /> },
  ];

  return (
    <>
      <PageHeader title="Pipeline" intro="Synthesis runs. Never shows document text, only sizes, counts and sanitized errors." />
      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <StatCard label="Runs, last 24 h" value={`${today ?? 0} / ${cap}`} hint="against the daily cap per user" tone={(today ?? 0) >= cap ? "danger" : "grey"} />
        <StatCard label="Failure rate, 24 h" value={`${rate}%`} hint={`${failed ?? 0} of ${all24 ?? 0} finished runs`} tone={rate > 20 ? "danger" : "grey"} />
        <StatCard label="Active provider" value={cfg.provider} tone={cfg.mode === "mock" ? "warn" : "blue"} hint={cfg.mode === "mock" ? "MOCK MODE: simulated output" : cfg.model || "model not set"} />
      </div>
      {cfg.mode === "mock" ? <p role="status" className="mb-4 mt-0 rounded-2xl bg-warn-bg px-4 py-2.5 text-sm font-semibold text-warn-ink">MOCK MODE is active. Runs are deterministic and simulated, not AI.</p> : null}

      {open ? (
        <aside aria-label="Run details" className="mb-5 rounded-3xl border-2 border-blue bg-white p-5">
          <h2 className="mt-0 text-lg">Run on {open.project_title}</h2>
          <KeyValueList items={[
            { label: "Status", value: <StatusPill tone={toneFor(open.status)}>{open.status}</StatusPill> },
            { label: "Provider / model", value: `${open.provider}${open.model ? ` / ${open.model}` : ""} (${open.mode})` },
            { label: "Error", value: open.error ?? "none" },
            { label: "Items drafted", value: `${open.items_total} (matched ${open.items_matched}, partial ${open.items_partial}, not found ${open.items_not_found})` },
            { label: "Input fingerprint", value: <code className="font-code text-[13px]">{open.input_hash.slice(0, 16) || "—"}</code> },
            { label: "Duration", value: `${open.duration_seconds}s` },
          ]} />
          <div className="mt-4 flex flex-wrap gap-2">
            {open.status === "failed" ? (
              <ReasonAction label="Retry run" consequence={<>Runs the synthesis again for this project. It counts toward the daily cap of the person who started it. Pending AI items are replaced.</>} action={retryRun.bind(null, open.id)} reasonLabel="Why are you retrying? (kept in the audit log)" successMessage="Retry finished." />
            ) : null}
            {open.status === "running" || open.status === "queued" ? (
              <ReasonAction label="Cancel stuck run" tone="danger" consequence={<>The run is marked failed with the message &ldquo;Cancelled by an admin&rdquo;. You can retry it afterwards.</>} action={cancelRun.bind(null, open.id)} successMessage="Run cancelled." />
            ) : null}
          </div>
        </aside>
      ) : null}

      <FilterBar
        searchLabel="Search project, provider or model"
        filters={[
          { key: "status", label: "Status", options: ["queued", "running", "done", "failed"].map((v) => ({ value: v, label: v })) },
          { key: "mode", label: "Mode", options: [{ value: "live", label: "live" }, { value: "mock", label: "mock" }] },
        ]}
      />
      <DateRange from={from} to={to} />
      <DataTable columns={columns} rows={rows} total={total} params={params} sp={sp} basePath="/admin/pipeline" rowHref={(r) => `/admin/pipeline?open=${r.id}`} caption="Synthesis runs" selectedId={openId} empty={{ title: "No runs match", text: "Runs appear after a creator drafts from their files." }} />
      <Panel className="mt-4"><p className="m-0 text-sm text-text-2">Failed runs older than the hourly project cap can be retried. Cancelling a run does not delete drafted items.</p></Panel>
    </>
  );
}
