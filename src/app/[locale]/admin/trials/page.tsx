import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { TrialChart } from "@/components/admin/TrialChart";
import { TrialPanel } from "@/components/admin/TrialPanel";
import { EMPTY_TRIAL, type TrialDraft } from "@/components/admin/TrialForm";
import { PageHeader, Panel, StatusPill, Time } from "@/components/admin/ui";
import { DemoBadge } from "@/components/ui/Badge";
import { queryView } from "@/lib/admin/query";
import { methodsParagraph, MIN_N, tooFew, type CohortSummary, type TrialRow } from "@/lib/admin/trials";
import { withParams, type SearchParams } from "@/lib/admin/table";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.trials" });
  return { title: t("metaTitle") };
}

type Row = TrialRow & { project_id: string | null; notes: string | null };

function toDraft(r: Row): TrialDraft {
  const local = (iso: string) => {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  return {
    id: r.id,
    participant_code: r.participant_code,
    cohort: r.cohort,
    project_id: r.project_id ?? "",
    started_at: local(r.started_at),
    minutes_to_understand: r.minutes_to_understand === null ? "" : String(r.minutes_to_understand),
    completed: r.completed,
    correct_answers: r.correct_answers === null ? "" : String(r.correct_answers),
    total_questions: r.total_questions === null ? "" : String(r.total_questions),
    sus_score: r.sus_score === null ? "" : String(r.sus_score),
    notes: r.notes ?? "",
    consent_confirmed: true,
    is_demo: r.is_demo,
  };
}

export default async function AdminTrialsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const t = await getTranslations("admin.trials");
  const pct = (v: number | null) => (v === null ? t("notAvailable") : `${Math.round(v * 100)}%`);
  const cohortName = (c: string) => t(c === "estafet" ? "cohortEstafet" : "cohortBaseline");
  const includeDemo = sp.demo === "1";
  const supabase = await createClient();
  const [{ rows, total, params }, { data: sum }, { data: all }, { data: projects }] = await Promise.all([
    queryView<Row>("admin_trials_v", sp, {
      sortable: ["started_at", "participant_code", "cohort", "minutes_to_understand"],
      defaultSort: "started_at",
      searchCols: ["participant_code", "project_title"],
      eq: { cohort: "cohort", project: "project_id" },
      demoCol: "is_demo",
    }),
    supabase.rpc("admin_trial_summary", { p_include_demo: includeDemo }),
    supabase
      .from("admin_trials_v")
      .select("*")
      .eq(includeDemo ? "consent_confirmed" : "is_demo", includeDemo ? true : false)
      .order("started_at", { ascending: true })
      .limit(500),
    supabase.from("admin_projects_v").select("id, title").order("title"),
  ]);
  const summary = (sum ?? []) as CohortSummary[];
  const chartRows = (all ?? []) as Row[];
  const by = (c: "baseline" | "estafet") => summary.find((s) => s.cohort === c);

  const edit = typeof sp.edit === "string" ? sp.edit : null;
  const editing =
    edit && edit !== "new"
      ? (chartRows.find((r) => r.id === edit) ??
        (await supabase.from("admin_trials_v").select("*").eq("id", edit).maybeSingle()).data)
      : null;
  const draft: TrialDraft | null = edit === "new" ? EMPTY_TRIAL : editing ? toDraft(editing as Row) : null;

  const first = chartRows[0]?.started_at;
  const last = chartRows[chartRows.length - 1]?.started_at;
  const methods = methodsParagraph(summary, {
    includesDemo: includeDemo && chartRows.some((r) => r.is_demo),
    first,
    last,
  });
  const exportHref = `/api/admin/trials/export${includeDemo ? "?demo=1" : ""}`;

  const columns: Column<Row>[] = [
    { key: "participant_code", label: t("colParticipant"), sortable: true },
    {
      key: "cohort",
      label: t("colCohort"),
      sortable: true,
      render: (r) => cohortName(r.cohort),
    },
    { key: "project_title", label: t("colProject"), render: (r) => r.project_title ?? "—" },
    {
      key: "minutes_to_understand",
      label: t("colMinutes"),
      sortable: true,
      render: (r) => r.minutes_to_understand ?? "—",
    },
    { key: "completed", label: t("colCompleted"), render: (r) => (r.completed ? t("yes") : t("no")) },
    {
      key: "score",
      label: t("colScore"),
      render: (r) => (r.total_questions ? `${r.correct_answers ?? 0}/${r.total_questions}` : "—"),
    },
    { key: "sus_score", label: t("colSus"), render: (r) => r.sus_score ?? "—" },
    { key: "is_demo", label: t("colDemo"), render: (r) => (r.is_demo ? <DemoBadge /> : "—") },
    { key: "started_at", label: t("colDate"), sortable: true, render: (r) => <Time iso={r.started_at} /> },
    {
      key: "edit",
      label: "",
      render: (r) => (
        <Link
          href={`/admin/trials${withParams(sp, { edit: r.id })}`}
          aria-label={t("editSession", { code: r.participant_code })}
        >
          {t("edit")}
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        actions={
          <Link
            href={`/admin/trials${withParams(sp, { edit: "new" })}`}
            className="inline-flex min-h-[44px] items-center rounded-full bg-lime px-5 font-semibold text-black no-underline"
          >
            {t("record")}
          </Link>
        }
      />
      {draft ? (
        <div className="mb-5">
          <TrialPanel
            key={draft.id ?? "new"}
            initial={draft}
            projects={(projects ?? []) as { id: string; title: string }[]}
          />
        </div>
      ) : null}

      <FilterBar
        searchLabel={t("search")}
        toggles={[{ key: "demo", label: t("includeDemo") }]}
        filters={[
          {
            key: "cohort",
            label: t("colCohort"),
            options: [
              { value: "baseline", label: t("cohortBaseline") },
              { value: "estafet", label: t("cohortEstafet") },
            ],
          },
        ]}
      />

      <div className="mb-5 grid gap-3 md:grid-cols-2">
        {(["baseline", "estafet"] as const).map((c) => {
          const s = by(c);
          return (
            <Panel key={c} title={t("cohortTitle", { cohort: cohortName(c), n: s?.n ?? 0 })}>
              {tooFew(s?.n) ? (
                <p role="status" className="m-0 rounded-2xl bg-warn-bg p-3 text-sm font-semibold text-warn-ink">
                  {t("tooFew", { n: s?.n ?? 0, min: MIN_N })}
                </p>
              ) : null}
              {s ? (
                <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-text-2">{t("median")}</dt>
                  <dd className="m-0 font-semibold">{s.median_minutes ?? t("notAvailable")}</dd>
                  <dt className="text-text-2">{t("mean")}</dt>
                  <dd className="m-0 font-semibold">{s.mean_minutes ?? t("notAvailable")}</dd>
                  <dt className="text-text-2">{t("completion")}</dt>
                  <dd className="m-0 font-semibold">
                    {pct(s.completion_rate)} ({t("ofN", { done: s.completed_n, n: s.n })})
                  </dd>
                  <dt className="text-text-2">{t("meanScore")}</dt>
                  <dd className="m-0 font-semibold">{pct(s.mean_score)}</dd>
                  {c === "estafet" ? (
                    <>
                      <dt className="text-text-2">{t("meanSus")}</dt>
                      <dd className="m-0 font-semibold">{s.mean_sus ?? t("notAvailable")}</dd>
                      <dt className="text-text-2">{t("within30")}</dt>
                      <dd className="m-0 font-semibold">
                        {pct(s.within30_share)} ({t("ofN", { done: s.within30_n, n: s.n })})
                      </dd>
                    </>
                  ) : null}
                </dl>
              ) : (
                <p className="m-0 mt-2 text-sm text-text-2">{t("noSessions")}</p>
              )}
            </Panel>
          );
        })}
      </div>

      <Panel title={t("chartTitle")} className="mb-5">
        <TrialChart rows={chartRows} summary={summary} />
      </Panel>

      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        params={params}
        sp={sp}
        basePath="/admin/trials"
        caption={t("caption")}
        empty={{
          title: t("emptyTitle"),
          text: t("emptyText"),
        }}
      />

      <Panel title={t("exportTitle")} className="mt-5">
        <p className="mt-0 text-sm text-text-2">{t("csvNote")}</p>
        <p className="mb-3">
          <a
            href={exportHref}
            download
            className="inline-flex min-h-[44px] items-center rounded-full border-[1.5px] border-line-strong bg-white px-5 font-semibold text-ink no-underline hover:bg-surface"
          >
            {t("download")}
          </a>
        </p>
        <h3 className="mb-1 mt-0 text-sm">{t("methodsTitle")}</h3>
        <p className="mb-2 mt-0 text-[13px] text-text-2">{t("methodsEnglish")}</p>
        <p className="m-0 rounded-2xl bg-white p-3.5 text-sm leading-relaxed">{methods}</p>
        {includeDemo ? (
          <p className="mb-0 mt-2">
            <StatusPill tone="warn">{t("demoIncluded")}</StatusPill>
          </p>
        ) : null}
      </Panel>
    </>
  );
}
