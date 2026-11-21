import type { CohortSummary, TrialRow } from "@/lib/admin/trials";

const COLORS = { baseline: "#4A5A66", estafet: "#1760D6" } as const;

/** Dot strip of minutes to understand by cohort with a median line. Plain SVG, with a data table fallback. */
export function TrialChart({ rows, summary }: { rows: TrialRow[]; summary: CohortSummary[] }) {
  const done = rows.filter((r) => r.completed && r.minutes_to_understand !== null);
  if (done.length === 0) return <p className="m-0 text-sm text-text-2">No completed sessions to plot yet.</p>;
  const max = Math.max(60, Math.ceil(Math.max(...done.map((r) => r.minutes_to_understand ?? 0)) / 10) * 10);
  const W = 640;
  const left = 90;
  const x = (m: number) => left + (m / max) * (W - left - 20);
  const cohorts = ["baseline", "estafet"] as const;
  const label = `Minutes to understand a project, by cohort. ${cohorts
    .map((c) => `${c}: median ${summary.find((s) => s.cohort === c)?.median_minutes ?? "not available"} minutes`)
    .join("; ")}.`;

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} 170`} role="img" aria-label={label} className="w-full max-w-[680px]">
        {[0, 10, 20, 30, 40, 50, 60]
          .filter((t) => t <= max)
          .map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={14}
                y2={128}
                stroke={t === 30 ? "#CDF54B" : "#DDE1E5"}
                strokeWidth={t === 30 ? 3 : 1}
              />
              <text x={x(t)} y={146} textAnchor="middle" fontSize="11" fill="#4A5A66">
                {t}
              </text>
            </g>
          ))}
        <text x={left + (W - left - 20) / 2} y={165} textAnchor="middle" fontSize="11" fill="#4A5A66">
          minutes to understand (completed sessions)
        </text>
        {cohorts.map((c, i) => {
          const y = 42 + i * 56;
          const pts = done.filter((r) => r.cohort === c);
          const median = summary.find((s) => s.cohort === c)?.median_minutes;
          return (
            <g key={c}>
              <text x={8} y={y + 4} fontSize="12" fontWeight="600" fill="#0E1A26">
                {c === "baseline" ? "Baseline" : "ESTAFET"}
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
      <figcaption className="mt-1 text-[13px] text-text-2">
        Black bar = median. Yellow-green line = the 30 minute target. Faded dashed dots are demo rows.
      </figcaption>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-semibold text-blue">Show the data as a table</summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="font-semibold">Cohort</th>
              <th className="font-semibold">Participant</th>
              <th className="font-semibold">Minutes</th>
              <th className="font-semibold">Demo</th>
            </tr>
          </thead>
          <tbody>
            {done.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td>{r.cohort}</td>
                <td>{r.participant_code}</td>
                <td>{r.minutes_to_understand}</td>
                <td>{r.is_demo ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
