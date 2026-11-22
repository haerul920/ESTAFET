import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Health endpoint for an uptime check (see docs/runbook.md). 200 when the app can reach its database, 503 otherwise.
 * It says nothing about versions, settings or people, so it is safe to leave public.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  try {
    const { error } = await createAdminClient()
      .from("app_settings")
      .select("key", { head: true, count: "exact" })
      .limit(1)
      .abortSignal(AbortSignal.timeout(3000));
    db = !error;
  } catch {
    db = false;
  }
  return NextResponse.json(
    { status: db ? "ok" : "degraded", database: db ? "up" : "down", time: new Date().toISOString() },
    { status: db ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
