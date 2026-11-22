import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { DateRange } from "@/components/admin/DateRange";
import { ReasonAction } from "@/components/admin/ReasonDialog";
import { KeyValueList, PageHeader, Panel, StatCard, StatusPill, Time, toneFor } from "@/components/admin/ui";
import { resendEmail } from "@/app/[locale]/admin/actions";
import { queryView } from "@/lib/admin/query";
import { hoursAgoIso } from "@/lib/admin/time";
import { statusText, type StatusTranslator } from "@/lib/admin/labels";
import { providerName } from "@/lib/email/provider";
import { TEMPLATES } from "@/lib/email/templates";
import type { SearchParams } from "@/lib/admin/table";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.emails" });
  return { title: t("title") };
}

interface Row {
  id: string;
  template: string;
  locale: string;
  essential: boolean;
  status: "pending" | "sending" | "sent" | "failed" | "skipped";
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  next_attempt_at: string;
  user_id: string;
  recipient_name: string | null;
  source: "notification" | "report";
}

const STATUSES = ["pending", "sending", "sent", "failed", "skipped"] as const;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
/** Outbox states: `sent` is good, `pending` and `sending` are on their way, `failed` needs a look. */
const tone = (s: string) =>
  s === "sent" ? "ok" : s === "failed" ? "danger" : s === "pending" || s === "sending" ? "warn" : toneFor(s);

/** Email log (PROMPTS_RELEASE.md R6 item 10). Metadata only: no address and no message text, like the outbox. */
export default async function AdminEmailsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [t, ts] = await Promise.all([getTranslations("admin.emails"), getTranslations("admin.status")]);
  const status = (k: string) =>
    k === "sending" || k === "sent" || k === "skipped"
      ? t(`st.${k}`)
      : statusText(ts as unknown as StatusTranslator, k);
  const from = first(sp.from);
  const to = first(sp.to);
  const { rows, total, params } = await queryView<Row>("admin_email_log_v", sp, {
    sortable: ["created_at", "template", "status", "attempts", "recipient_name"],
    defaultSort: "created_at",
    searchCols: ["template", "recipient_name", "last_error"],
    eq: { status: "status", template: "template" },
    apply: (q) => {
      let r = q;
      if (first(sp.essential) === "1") r = r.eq("essential", true);
      if (from) r = r.gte("created_at", `${from}T00:00:00+08:00`);
      if (to) r = r.lte("created_at", `${to}T23:59:59+08:00`);
      return r;
    },
  });

  // Counts for the last 7 days come from the view, so they follow is_admin() like everything else here.
  const supabase = await createClient();
  const weekAgo = hoursAgoIso(24 * 7);
  const count = (s: string[]) =>
    supabase
      .from("admin_email_log_v")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo)
      .in("status", s);
  const [{ count: sent }, { count: failed }, { count: waiting }, { count: skipped }] = await Promise.all([
    count(["sent"]),
    count(["failed"]),
    count(["pending", "sending"]),
    count(["skipped"]),
  ]);
  const provider = providerName();
  const noDelivery = provider === "none" || provider === "log";

  const openId = typeof sp.open === "string" ? sp.open : null;
  const open =
    rows.find((r) => r.id === openId) ??
    (openId
      ? ((await supabase.from("admin_email_log_v").select("*").eq("id", openId).maybeSingle()).data as Row | null)
      : null);

  const columns: Column<Row>[] = [
    {
      key: "template",
      label: t("colTemplate"),
      sortable: true,
      render: (r) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <code className="font-code text-[13px]">{r.template}</code>
          {r.essential ? <StatusPill tone="info">{t("essential")}</StatusPill> : null}
        </span>
      ),
    },
    { key: "recipient_name", label: t("colRecipient"), sortable: true, render: (r) => r.recipient_name || "—" },
    {
      key: "status",
      label: t("colStatus"),
      sortable: true,
      render: (r) => <StatusPill tone={tone(r.status)}>{status(r.status)}</StatusPill>,
    },
    { key: "attempts", label: t("colAttempts"), sortable: true, render: (r) => `${r.attempts} / 5` },
    {
      key: "last_error",
      label: t("colError"),
      render: (r) => (r.last_error ? <code className="font-code text-[13px]">{r.last_error}</code> : "—"),
    },
    { key: "created_at", label: t("colCreated"), sortable: true, render: (r) => <Time iso={r.created_at} /> },
  ];

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <StatCard label={t("sent7")} value={sent ?? 0} href="/admin/emails?status=sent" tone="grey" />
        <StatCard
          label={t("failed7")}
          value={failed ?? 0}
          href="/admin/emails?status=failed"
          tone={failed ? "danger" : "grey"}
        />
        <StatCard
          label={t("waiting7")}
          value={waiting ?? 0}
          hint={t("waitingHint")}
          href="/admin/emails?status=pending"
          tone={waiting ? "warn" : "grey"}
        />
        <StatCard label={t("skipped7")} value={skipped ?? 0} hint={t("skippedHint")} tone="grey" />
        <StatCard
          label={t("provider")}
          value={provider}
          hint={noDelivery ? t("providerOff") : undefined}
          tone={noDelivery ? "warn" : "blue"}
        />
      </div>
      {noDelivery ? (
        <p role="status" className="mb-4 mt-0 rounded-2xl bg-warn-bg px-4 py-2.5 text-sm font-semibold text-warn-ink">
          {t("providerBanner", { provider })}
        </p>
      ) : null}

      {open ? (
        <aside aria-label={t("panelLabel")} className="mb-5 rounded-3xl border-2 border-blue bg-white p-5">
          <h2 className="mt-0 text-lg">
            <code className="font-code">{open.template}</code>
          </h2>
          <KeyValueList
            items={[
              {
                label: t("colStatus"),
                value: <StatusPill tone={tone(open.status)}>{status(open.status)}</StatusPill>,
              },
              {
                label: t("colRecipient"),
                value: (
                  <Link href={`/admin/users/${open.user_id}`} className="font-semibold text-blue underline">
                    {open.recipient_name || t("unnamed")}
                  </Link>
                ),
              },
              { label: t("kind"), value: open.essential ? t("kindEssential") : t("kindRegular") },
              { label: t("source"), value: open.source === "report" ? t("sourceReport") : t("sourceNotification") },
              { label: t("language"), value: open.locale.toUpperCase() },
              { label: t("colAttempts"), value: `${open.attempts} / 5` },
              {
                label: t("colError"),
                value: open.last_error ? (
                  <span className="flex flex-col gap-1">
                    <code className="font-code text-[13px]">{open.last_error}</code>
                    <span className="text-text-2">{errorHelp(t, open.last_error)}</span>
                  </span>
                ) : (
                  t("none")
                ),
              },
              { label: t("colCreated"), value: <Time iso={open.created_at} /> },
              { label: t("sentAt"), value: open.sent_at ? <Time iso={open.sent_at} /> : t("notSent") },
              ...(open.status === "pending"
                ? [{ label: t("nextAttempt"), value: <Time iso={open.next_attempt_at} /> }]
                : []),
            ]}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {open.status === "failed" && open.essential ? (
              <ReasonAction
                label={t("resend")}
                consequence={t("resendEffect")}
                action={resendEmail.bind(null, open.id)}
                reasonLabel={t("resendReason")}
                successMessage={t("resent")}
              />
            ) : open.status === "failed" ? (
              <p className="m-0 text-sm text-text-2">{t("resendOnlyEssential")}</p>
            ) : null}
          </div>
        </aside>
      ) : null}

      <FilterBar
        searchLabel={t("search")}
        filters={[
          { key: "status", label: t("colStatus"), options: STATUSES.map((v) => ({ value: v, label: status(v) })) },
          { key: "template", label: t("colTemplate"), options: TEMPLATES.map((v) => ({ value: v, label: v })) },
        ]}
        toggles={[{ key: "essential", label: t("onlyEssential") }]}
      />
      <DateRange from={from} to={to} />
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        params={params}
        sp={sp}
        basePath="/admin/emails"
        rowHref={(r) => `/admin/emails?open=${r.id}`}
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

/** A plain explanation for the short error codes the sender stores (src/lib/email/dispatch.ts and provider.ts). */
function errorHelp(t: (key: string) => string, code: string): string {
  if (code === "no_address") return t("err.no_address");
  if (code === "unknown_template") return t("err.unknown_template");
  if (code === "no_provider") return t("err.no_provider");
  if (code.startsWith("resend_")) return t("err.resend");
  if (code.startsWith("smtp_")) return t("err.smtp");
  return t("err.other");
}
