import type { Metadata } from "next";
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

export const metadata: Metadata = { title: "Trials" };

type Row = TrialRow & { project_id: string | null; notes: string | null };
const pct = (v: number | null) => (v === null ? "n/a" : `${Math.round(v * 100)}%`);

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
    { key: "participant_code", label: "Participant", sortable: true },
    {
      key: "cohort",
      label: "Cohort",
      sortable: true,
      render: (r) => (r.cohort === "estafet" ? "ESTAFET" : "Baseline"),
    },
    { key: "project_title", label: "Project", render: (r) => r.project_title ?? "—" },
    { key: "minutes_to_understand", label: "Minutes", sortable: true, render: (r) => r.minutes_to_understand ?? "—" },
    { key: "completed", label: "Completed", render: (r) => (r.completed ? "yes" : "no") },
    {
      key: "score",
      label: "Score",
      render: (r) => (r.total_questions ? `${r.correct_answers ?? 0}/${r.total_questions}` : "—"),
    },
    { key: "sus_score", label: "SUS", render: (r) => r.sus_score ?? "—" },
    { key: "is_demo", label: "Demo", render: (r) => (r.is_demo ? <DemoBadge /> : "—") },
    { key: "started_at", label: "Date", sortable: true, render: (r) => <Time iso={r.started_at} /> },
    {
      key: "edit",
      label: "",
      render: (r) => (
        <Link href={`/admin/trials${withParams(sp, { edit: r.id })}`} aria-label={`Edit session ${r.participant_code}`}>
          Edit
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Onboarding trials"
        intro="Real sessions only. Numbers show n. Demo rows are excluded unless you include them."
        actions={
          <Link
            href={`/admin/trials${withParams(sp, { edit: "new" })}`}
            className="inline-flex min-h-[44px] items-center rounded-full bg-lime px-5 font-semibold text-black no-underline"
          >
            Record session
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
        searchLabel="Search participant or project"
        toggles={[{ key: "demo", label: "Include demo rows" }]}
        filters={[
          {
            key: "cohort",
            label: "Cohort",
            options: [
              { value: "baseline", label: "baseline" },
              { value: "estafet", label: "ESTAFET" },
            ],
          },
        ]}
      />

      <div className="mb-5 grid gap-3 md:grid-cols-2">
        {(["baseline", "estafet"] as const).map((c) => {
          const s = by(c);
          return (
            <Panel key={c} title={`${c === "baseline" ? "Baseline" : "ESTAFET"} (n = ${s?.n ?? 0})`}>
              {tooFew(s?.n) ? (
                <p role="status" className="m-0 rounded-2xl bg-warn-bg p-3 text-sm font-semibold text-warn-ink">
                  Too few sessions to conclude (n = {s?.n ?? 0}, at least {MIN_N} needed). Numbers below are shown for
                  reference only.
                </p>
              ) : null}
              {s ? (
                <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-text-2">Median minutes (completed)</dt>
                  <dd className="m-0 font-semibold">{s.median_minutes ?? "n/a"}</dd>
                  <dt className="text-text-2">Mean minutes (completed)</dt>
                  <dd className="m-0 font-semibold">{s.mean_minutes ?? "n/a"}</dd>
                  <dt className="text-text-2">Completion rate</dt>
                  <dd className="m-0 font-semibold">
                    {pct(s.completion_rate)} ({s.completed_n} of {s.n})
                  </dd>
                  <dt className="text-text-2">Mean comprehension score</dt>
                  <dd className="m-0 font-semibold">{pct(s.mean_score)}</dd>
                  {c === "estafet" ? (
                    <>
                      <dt className="text-text-2">Mean SUS</dt>
                      <dd className="m-0 font-semibold">{s.mean_sus ?? "n/a"}</dd>
                      <dt className="text-text-2">Finished within 30 min</dt>
                      <dd className="m-0 font-semibold">
                        {pct(s.within30_share)} ({s.within30_n} of {s.n})
                      </dd>
                    </>
                  ) : null}
                </dl>
              ) : (
                <p className="m-0 mt-2 text-sm text-text-2">No sessions in this cohort.</p>
              )}
            </Panel>
          );
        })}
      </div>

      <Panel title="Minutes to understand, by cohort" className="mb-5">
        <TrialChart rows={chartRows} summary={summary} />
      </Panel>

      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        params={params}
        sp={sp}
        basePath="/admin/trials"
        caption="Trial sessions"
        empty={{
          title: "No sessions yet",
          text: "Record a session after each onboarding trial. Demo rows are hidden unless you include them.",
        }}
      />

      <Panel title="Export and methods" className="mt-5">
        <p className="mt-0 text-sm text-text-2">The CSV has pseudonym codes only: no names, no emails.</p>
        <p className="mb-3">
          <a
            href={exportHref}
            download
            className="inline-flex min-h-[44px] items-center rounded-full border-[1.5px] border-line-strong bg-white px-5 font-semibold text-ink no-underline hover:bg-surface"
          >
            Download CSV
          </a>
        </p>
        <h3 className="mb-1 mt-0 text-sm">Methods and limits (paste into the proposal)</h3>
        <p className="m-0 rounded-2xl bg-white p-3.5 text-sm leading-relaxed">{methods}</p>
        {includeDemo ? (
          <p className="mb-0 mt-2">
            <StatusPill tone="warn">Demo rows included</StatusPill>
          </p>
        ) : null}
      </Panel>
    </>
  );
}
