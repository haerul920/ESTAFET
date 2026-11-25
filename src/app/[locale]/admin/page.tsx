import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Panel, StatCard, StatusPill, Time, toneFor, EmptyState } from "@/components/admin/ui";
import { getSettings } from "@/lib/settings";
import { environmentName } from "@/lib/admin/env";
import { checkConfig } from "@/lib/config";
import { statusText, type StatusTranslator } from "@/lib/admin/labels";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.overview" });
  return { title: t("metaTitle") };
}

interface Overview {
  open_reports: number;
  new_reports_24h: number;
  open_appeals: number;
  median_days_to_publish: number | null;
  projects_by_status: Record<string, number>;
  projects_by_moderation: Record<string, number>;
  access_by_mode: Record<string, number>;
  requests_by_status: Record<string, number>;
  reports_by_reason: Record<string, number>;
  reports_by_outcome: Record<string, number>;
  users_total: number;
  users_suspended: number;
}
interface AuditRow {
  id: string;
  actor_name: string;
  action: string;
  target_type: string;
  reason: string | null;
  created_at: string;
}

function Counts({ map, empty, label }: { map: Record<string, number>; empty: string; label: (key: string) => string }) {
  const entries = Object.entries(map);
  if (entries.length === 0) return <p className="m-0 text-sm text-text-2">{empty}</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
      {entries.map(([k, n]) => (
        <li key={k} className="flex items-center justify-between">
          <StatusPill tone={toneFor(k)}>{label(k)}</StatusPill>
          <strong>{n}</strong>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminOverviewPage() {
  const [t, ts, tr, tm] = await Promise.all([
    getTranslations("admin.overview"),
    getTranslations("admin.status"),
    getTranslations("admin.reasons"),
    getTranslations("admin.modes"),
  ]);
  const status = (k: string) => statusText(ts as unknown as StatusTranslator, k);
  const supabase = await createClient();
  const [{ data }, { data: audit }, settings] = await Promise.all([
    // Real data only: demo rows never count towards these numbers (CLAUDE.md 13.4).
    supabase.rpc("admin_overview", { p_include_demo: false }),
    supabase
      .from("admin_audit_v")
      .select("id, actor_name, action, target_type, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    getSettings(),
  ]);
  const o = data as Overview;
  const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <ConfigWarning t={t} />

      <h2 className="mono-label mb-2 mt-0 text-xs font-normal text-text-2">{t("queues")}</h2>
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <StatCard
          label={t("openReports")}
          value={o.open_reports}
          hint={o.new_reports_24h ? t("newIn24h", { count: o.new_reports_24h }) : undefined}
          href="/admin/reports?status=open"
          tone={o.open_reports ? "warn" : "grey"}
        />
        <StatCard
          label={t("openAppeals")}
          value={o.open_appeals}
          href="/admin/appeals?status=open"
          tone={o.open_appeals ? "warn" : "grey"}
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title={t("projectsByStatus", { count: sum(o.projects_by_status) })}>
          {Object.keys(o.projects_by_status).length === 0 ? (
            <p className="m-0 text-sm text-text-2">{t("noProjects")}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
              {Object.entries(o.projects_by_status).map(([k, n]) => (
                <li key={k} className="flex items-center justify-between">
                  <StatusPill tone={toneFor(k)}>{status(k)}</StatusPill>
                  <strong>{n}</strong>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("requestsByStatus", { count: sum(o.requests_by_status) })}>
          {Object.keys(o.requests_by_status).length === 0 ? (
            <p className="m-0 text-sm text-text-2">{t("noRequests")}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
              {Object.entries(o.requests_by_status).map(([k, n]) => (
                <li key={k} className="flex items-center justify-between">
                  <StatusPill tone={toneFor(k)}>{status(k)}</StatusPill>
                  <strong>{n}</strong>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("moderationState")}>
          <Counts map={o.projects_by_moderation} empty={t("noProjects")} label={status} />
        </Panel>
        <Panel title={t("accessMode")}>
          <Counts map={o.access_by_mode} empty={t("noPublished")} label={(k) => (tm.has(k) ? tm(k) : k)} />
        </Panel>
        <Panel title={t("reportsByReason", { count: sum(o.reports_by_reason) })}>
          <Counts map={o.reports_by_reason} empty={t("noReports")} label={(k) => (tr.has(k) ? tr(k) : k)} />
        </Panel>
        <Panel title={t("reportsByOutcome", { count: sum(o.reports_by_outcome) })}>
          <Counts map={o.reports_by_outcome} empty={t("noReports")} label={status} />
        </Panel>
        <Panel title={t("people")}>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
            <li className="flex justify-between">
              <span>{t("users")}</span>
              <strong>{o.users_total}</strong>
            </li>
            <li className="flex justify-between">
              <span>{t("suspendedUsers")}</span>
              <strong>{o.users_suspended}</strong>
            </li>
            <li className="flex justify-between">
              <span>{t("median")}</span>
              <strong>{o.median_days_to_publish ?? t("noData")}</strong>
            </li>
            <li className="flex justify-between">
              <span>{t("environment")}</span>
              <strong>{environmentName()}</strong>
            </li>
            <li className="flex justify-between">
              <span>{t("registrations")}</span>
              <strong>{settings.registrations_open.value ? t("regOpen") : t("regClosed")}</strong>
            </li>
          </ul>
        </Panel>
      </div>

      <Panel
        title={t("recentAudit")}
        action={
          <Link href="/admin/audit" className="text-sm">
            {t("viewAll")}
          </Link>
        }
      >
        {(audit ?? []).length === 0 ? (
          <EmptyState title={t("noAudit")} text={t("noAuditText")} />
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
            {(audit as AuditRow[]).map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                <span>
                  <strong>{a.actor_name}</strong> <code className="font-code text-[13px]">{a.action}</code>{" "}
                  <span className="text-text-2">{a.target_type}</span>
                  {a.reason ? <span className="block text-text-2">“{a.reason}”</span> : null}
                </span>
                <Time iso={a.created_at} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

/**
 * A production site without APP_ENV keeps serving even when its configuration is incomplete (see src/lib/boot.ts).
 * Admins must see that, so the problems are listed here until APP_ENV is set and the configuration is fixed.
 */
function ConfigWarning({ t }: { t: (key: string) => string }) {
  if (process.env.APP_ENV?.trim()) return null;
  const report = checkConfig();
  if (report.env !== "PRODUCTION" || report.errors.length === 0) return null;
  return (
    <div role="alert" className="mb-4 rounded-2xl bg-[#fdecea] px-4 py-3 text-sm text-danger">
      <strong className="mb-1 block">{t("configTitle")}</strong>
      <p className="m-0 mb-2">{t("configText")}</p>
      <ul className="m-0 flex flex-col gap-1 pl-5">
        {report.errors.map((e) => (
          <li key={e} className="font-code text-[13px]">
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
}
