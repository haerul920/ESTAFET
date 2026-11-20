import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Global admin search. The database function checks is_admin(); everyone else gets 404. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_search", { p_q: q.slice(0, 80) });
  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
