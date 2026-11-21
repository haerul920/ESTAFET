import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trialsCsv, type TrialRow } from "@/lib/admin/trials";

export const runtime = "nodejs";

/** CSV of trial sessions. Pseudonym codes only. Demo rows only with ?demo=1. Admin-only (view + proxy). */
export async function GET(req: Request) {
  const demo = new URL(req.url).searchParams.get("demo") === "1";
  const supabase = await createClient();
  let q = supabase
    .from("admin_trials_v")
    .select(
      "id, participant_code, cohort, project_title, started_at, minutes_to_understand, completed, correct_answers, total_questions, sus_score, is_demo",
    )
    .order("started_at", { ascending: true })
    .limit(5000);
  if (!demo) q = q.eq("is_demo", false);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(trialsCsv((data ?? []) as TrialRow[]), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="estafet-trials${demo ? "-with-demo" : ""}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
