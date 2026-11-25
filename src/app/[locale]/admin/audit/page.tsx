import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { DateRange } from "@/components/admin/DateRange";
import { KeyValueList, PageHeader, Panel, Time } from "@/components/admin/ui";
import { queryView } from "@/lib/admin/query";
import { diffObjects, type AuditEvent } from "@/lib/admin/audit";
import { formatWita, type AdminLocale } from "@/lib/admin/time";
import { withParams, type SearchParams } from "@/lib/admin/table";
import { cn } from "@/lib/cn";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.audit" });
  return { title: t("title") };
}

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
  const [locale, t, tt] = await Promise.all([
    getLocale(),
    getTranslations("admin.audit"),
    getTranslations("admin.targets"),
  ]);
  const target = (k: string) =>
    (tt as unknown as { has(k: string): boolean }).has(k) ? tt(k as never) : k.replaceAll("_", " ");
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
      label: t("when"),
      sortable: true,
      render: (r) => <Time iso={r.created_at} className="text-ink" />,
    },
    { key: "actor_name", label: t("actor"), sortable: true },
    {
      key: "action",
      label: t("action"),
      sortable: true,
      render: (r) => <code className="font-code text-[13px]">{r.action}</code>,
    },
    {
      key: "target_type",
      label: t("target"),
      sortable: true,
      render: (r) => `${target(r.target_type)}${r.target_id ? ` ${r.target_id.slice(0, 8)}` : ""}`,
    },
    {
      key: "reason",
      label: t("reason"),
      render: (r) => <span className="line-clamp-2 max-w-[320px] text-text-2">{r.reason ?? "—"}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        actions={
          <a
            href={`/api/admin/audit/export${exportQs}`}
            download
            className="inline-flex min-h-[44px] items-center rounded-full border-[1.5px] border-line-strong bg-white px-5 font-semibold text-ink no-underline hover:bg-surface"
          >
            {t("export")}
          </a>
        }
      />
      <p className="mb-4 mt-0 flex items-center gap-2 rounded-2xl bg-blue-tint px-4 py-2.5 text-sm text-text-3">
        <Lock size={16} aria-hidden="true" /> {t("appendOnly")}
      </p>

      {open ? (
        <aside aria-label={t("panelLabel")} className="mb-5 rounded-3xl border-2 border-blue bg-white p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <h2 className="m-0 text-lg">
              <code className="font-code">{open.action}</code>
            </h2>
            <Link href={`/admin/audit${withParams(sp, { open: undefined })}`} className="text-sm">
              {t("close")}
            </Link>
          </div>
          <KeyValueList
            items={[
              { label: t("actor"), value: open.actor_name },
              { label: t("when"), value: formatWita(open.created_at, locale as AdminLocale) },
              {
                label: t("target"),
                value: `${target(open.target_type)}${open.target_id ? ` (${open.target_id})` : ""}`,
              },
              { label: t("reason"), value: open.reason ?? "—" },
            ]}
          />
          <h3 className="mb-2 mt-4 text-sm">{t("beforeAfter")}</h3>
          {open.before || open.after ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-text-2">
                    <th className="py-1 pr-3 font-semibold">{t("field")}</th>
                    <th className="pr-3 font-semibold">{t("before")}</th>
                    <th className="font-semibold">{t("after")}</th>
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
            </div>
          ) : (
            <p className="m-0 text-sm text-text-2">{t("noDiff")}</p>
          )}
        </aside>
      ) : null}

      <FilterBar
        searchLabel={t("search")}
        filters={[
          {
            key: "target",
            label: t("targetType"),
            options: TARGETS.map((v) => ({ value: v, label: target(v) })),
          },
        ]}
      />
      <AuditTextFilters actor={actor} action={action} />
      <DateRange from={from} to={to} />
      <Panel className="p-0">
        <span className="sr-only">{t("resultsBelow")}</span>
      </Panel>
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        params={params}
        sp={sp}
        basePath="/admin/audit"
        rowHref={(r) => `/admin/audit${withParams(sp, { open: r.id })}`}
        caption={t("caption")}
        selectedId={openId}
        empty={{ title: t("emptyTitle"), text: t("emptyText") }}
      />
    </>
  );
}

/** Plain GET form so actor and action filters work without client JS. */
function AuditTextFilters({ actor, action }: { actor?: string; action?: string }) {
  const t = useTranslations("admin.audit");
  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
      <label className="flex flex-col gap-1">
        {t("actor")}
        <input
          name="actor"
          defaultValue={actor}
          className="min-h-[40px] rounded-xl border border-line-strong bg-white px-3"
        />
      </label>
      <label className="flex flex-col gap-1">
        {t("actionStarts")}
        <input
          name="action"
          defaultValue={action}
          placeholder={t("actionPlaceholder")}
          className="min-h-[40px] rounded-xl border border-line-strong bg-white px-3"
        />
      </label>
      <button
        type="submit"
        className="min-h-[40px] cursor-pointer rounded-full border-[1.5px] border-line-strong bg-white px-4 font-semibold hover:bg-surface"
      >
        {t("apply")}
      </button>
    </form>
  );
}
