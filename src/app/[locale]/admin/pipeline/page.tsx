import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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
import { statusText, type StatusTranslator } from "@/lib/admin/labels";
import type { SearchParams } from "@/lib/admin/table";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.pipeline" });
  return { title: t("title") };
}

interface Row {
  id: string;
  project_id: string;
  project_title: string;
  provider: string;
  model: string;
  mode: string;
  status: string;
  error: string | null;
  input_hash: string;
  created_at: string;
  duration_seconds: number;
  items_total: number;
  items_matched: number;
  items_partial: number;
  items_not_found: number;
  is_demo: boolean;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminPipelinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [t, ts] = await Promise.all([getTranslations("admin.pipeline"), getTranslations("admin.status")]);
  const status = (k: string) => statusText(ts as unknown as StatusTranslator, k);
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
    supabase
      .from("admin_runs_v")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo)
      .eq("status", "failed"),
    supabase
      .from("admin_runs_v")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo)
      .in("status", ["done", "failed"]),
  ]);
  const cfg = getConfig();
  const cap = (await getSettings()).synthesis_daily_cap.value;
  const rate = all24 ? Math.round(((failed ?? 0) / all24) * 100) : 0;

  const openId = typeof sp.open === "string" ? sp.open : null;
  const open =
    rows.find((r) => r.id === openId) ??
    (openId
      ? ((await supabase.from("admin_runs_v").select("*").eq("id", openId).maybeSingle()).data as Row | null)
      : null);

  const columns: Column<Row>[] = [
    { key: "project_title", label: t("colProject"), sortable: true },
    { key: "provider", label: t("colProvider"), render: (r) => r.provider },
    { key: "model", label: t("colModel"), render: (r) => r.model || "—" },
    {
      key: "mode",
      label: t("colMode"),
      sortable: true,
      render: (r) => <StatusPill tone={r.mode === "mock" ? "warn" : "info"}>{status(r.mode)}</StatusPill>,
    },
    {
      key: "status",
      label: t("colStatus"),
      sortable: true,
      render: (r) => <StatusPill tone={toneFor(r.status)}>{status(r.status)}</StatusPill>,
    },
    { key: "duration_seconds", label: t("colDuration"), sortable: true, render: (r) => `${r.duration_seconds}s` },
    {
      key: "error",
      label: t("colError"),
      render: (r) => <span className="line-clamp-2 max-w-[260px] text-text-2">{r.error ?? "—"}</span>,
    },
    { key: "created_at", label: t("colStarted"), sortable: true, render: (r) => <Time iso={r.created_at} /> },
  ];

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <StatCard
          label={t("runs24")}
          value={`${today ?? 0} / ${cap}`}
          hint={t("capHint")}
          tone={(today ?? 0) >= cap ? "danger" : "grey"}
        />
        <StatCard
          label={t("failRate")}
          value={`${rate}%`}
          hint={t("finished", { failed: failed ?? 0, all: all24 ?? 0 })}
          tone={rate > 20 ? "danger" : "grey"}
        />
        <StatCard
          label={t("activeProvider")}
          value={cfg.provider}
          tone={cfg.mode === "mock" ? "warn" : "blue"}
          hint={cfg.mode === "mock" ? t("mockHint") : cfg.model || t("noModel")}
        />
      </div>
      {cfg.mode === "mock" ? (
        <p role="status" className="mb-4 mt-0 rounded-2xl bg-warn-bg px-4 py-2.5 text-sm font-semibold text-warn-ink">
          {t("mockBanner")}
        </p>
      ) : null}

      {open ? (
        <aside aria-label={t("panelLabel")} className="mb-5 rounded-3xl border-2 border-blue bg-white p-5">
          <h2 className="mt-0 text-lg">{t("runOn", { project: open.project_title })}</h2>
          <KeyValueList
            items={[
              {
                label: t("colStatus"),
                value: <StatusPill tone={toneFor(open.status)}>{status(open.status)}</StatusPill>,
              },
              {
                label: t("providerModel"),
                value: `${open.provider}${open.model ? ` / ${open.model}` : ""} (${open.mode})`,
              },
              { label: t("colError"), value: open.error ?? t("none") },
              {
                label: t("itemsDrafted"),
                value: t("itemsValue", {
                  total: open.items_total,
                  matched: open.items_matched,
                  partial: open.items_partial,
                  notFound: open.items_not_found,
                }),
              },
              {
                label: t("fingerprint"),
                value: <code className="font-code text-[13px]">{open.input_hash.slice(0, 16) || "—"}</code>,
              },
              { label: t("colDuration"), value: `${open.duration_seconds}s` },
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {open.status === "failed" ? (
              <ReasonAction
                label={t("retry")}
                consequence={t("retryEffect")}
                action={retryRun.bind(null, open.id)}
                reasonLabel={t("retryReason")}
                successMessage={t("retried")}
              />
            ) : null}
            {open.status === "running" || open.status === "queued" ? (
              <ReasonAction
                label={t("cancel")}
                tone="danger"
                consequence={t("cancelEffect")}
                action={cancelRun.bind(null, open.id)}
                successMessage={t("cancelled")}
              />
            ) : null}
          </div>
        </aside>
      ) : null}

      <FilterBar
        searchLabel={t("search")}
        filters={[
          {
            key: "status",
            label: t("colStatus"),
            options: ["queued", "running", "done", "failed"].map((v) => ({ value: v, label: status(v) })),
          },
          {
            key: "mode",
            label: t("colMode"),
            options: [
              { value: "live", label: status("live") },
              { value: "mock", label: status("mock") },
            ],
          },
        ]}
      />
      <DateRange from={from} to={to} />
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        params={params}
        sp={sp}
        basePath="/admin/pipeline"
        rowHref={(r) => `/admin/pipeline?open=${r.id}`}
        caption={t("caption")}
        selectedId={openId}
        empty={{ title: t("emptyTitle"), text: t("emptyText") }}
      />
      <Panel className="mt-4">
        <p className="m-0 text-sm text-text-2">{t("footnote")}</p>
      </Panel>
    </>
  );
}
