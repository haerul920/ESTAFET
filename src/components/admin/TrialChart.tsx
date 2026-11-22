import { useTranslations } from "next-intl";
import type { CohortSummary, TrialRow } from "@/lib/admin/trials";

const COLORS = { baseline: "#4A5A66", estafet: "#1760D6" } as const;

/** Dot strip of minutes to understand by cohort with a median line. Plain SVG, with a data table fallback. */
export function TrialChart({ rows, summary }: { rows: TrialRow[]; summary: CohortSummary[] }) {
  const t = useTranslations("admin.trials");
  const done = rows.filter((r) => r.completed && r.minutes_to_understand !== null);
  if (done.length === 0) return <p className="m-0 text-sm text-text-2">{t("chartEmpty")}</p>;
  const max = Math.max(60, Math.ceil(Math.max(...done.map((r) => r.minutes_to_understand ?? 0)) / 10) * 10);
  const W = 640;
  const left = 90;
  const x = (m: number) => left + (m / max) * (W - left - 20);
  const cohorts = ["baseline", "estafet"] as const;
  const label = t("chartLabel", {
    summary: cohorts
      .map((c) =>
        t("chartMedian", {
          cohort: t(c === "baseline" ? "cohortBaseline" : "cohortEstafet"),
          minutes: summary.find((s) => s.cohort === c)?.median_minutes ?? t("notAvailable"),
        }),
      )
      .join("; "),
  });

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} 170`} role="img" aria-label={label} className="w-full max-w-[680px]">
        {[0, 10, 20, 30, 40, 50, 60]
          .filter((m) => m <= max)
          .map((m) => (
            <g key={m}>
              <line
                x1={x(m)}
                x2={x(m)}
                y1={14}
                y2={128}
                stroke={m === 30 ? "#CDF54B" : "#DDE1E5"}
                strokeWidth={m === 30 ? 3 : 1}
              />
              <text x={x(m)} y={146} textAnchor="middle" fontSize="11" fill="#4A5A66">
                {m}
              </text>
            </g>
          ))}
        <text x={left + (W - left - 20) / 2} y={165} textAnchor="middle" fontSize="11" fill="#4A5A66">
          {t("axis")}
        </text>
        {cohorts.map((c, i) => {
          const y = 42 + i * 56;
          const pts = done.filter((r) => r.cohort === c);
          const median = summary.find((s) => s.cohort === c)?.median_minutes;
          return (
            <g key={c}>
              <text x={8} y={y + 4} fontSize="12" fontWeight="600" fill="#0E1A26">
                {t(c === "baseline" ? "cohortBaseline" : "cohortEstafet")}
              </text>
              <text x={8} y={y + 18} fontSize="10" fill="#4A5A66">
                n = {summary.find((s) => s.cohort === c)?.n ?? 0}
              </text>
              <line x1={left} x2={W - 20} y1={y} y2={y} stroke="#E1E5E9" />
              {pts.map((r, k) => (
                <circle
                  key={r.id}
                  cx={x(r.minutes_to_understand!)}
                  cy={y + ((k % 3) - 1) * 9}
                  r={6}
                  fill={COLORS[c]}
                  fillOpacity={r.is_demo ? 0.45 : 0.9}
                  stroke={r.is_demo ? COLORS[c] : "none"}
                  strokeDasharray={r.is_demo ? "2 2" : undefined}
                />
              ))}
              {median !== null && median !== undefined ? (
                <line x1={x(median)} x2={x(median)} y1={y - 22} y2={y + 22} stroke="#10151A" strokeWidth={2.5} />
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-[13px] text-text-2">{t("legend")}</figcaption>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-semibold text-blue">{t("showTable")}</summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="font-semibold">{t("colCohort")}</th>
              <th className="font-semibold">{t("colParticipant")}</th>
              <th className="font-semibold">{t("colMinutes")}</th>
              <th className="font-semibold">{t("colDemo")}</th>
            </tr>
          </thead>
          <tbody>
            {done.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td>{t(r.cohort === "baseline" ? "cohortBaseline" : "cohortEstafet")}</td>
                <td>{r.participant_code}</td>
                <td>{r.minutes_to_understand}</td>
                <td>{r.is_demo ? t("yes") : t("no")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
