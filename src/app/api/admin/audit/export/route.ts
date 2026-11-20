import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditCsv, type AuditEvent } from "@/lib/admin/audit";

export const runtime = "nodejs";

/** CSV of the audit log for the current filter. Admin-only (view and proxy). */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const supabase = await createClient();
  let q = supabase.from("admin_audit_v").select("*").order("created_at", { ascending: false }).limit(5000);
  const clean = (s: string) => s.replace(/[%,()]/g, " ");
  const text = sp.get("q")?.trim();
  if (text) q = q.or(["action", "reason", "actor_name"].map((c) => `${c}.ilike.%${clean(text)}%`).join(","));
  if (sp.get("target")) q = q.eq("target_type", sp.get("target")!);
  if (sp.get("actor")) q = q.ilike("actor_name", `%${clean(sp.get("actor")!.trim())}%`);
  if (sp.get("action")) q = q.ilike("action", `${clean(sp.get("action")!.trim())}%`);
  if (sp.get("from")) q = q.gte("created_at", `${sp.get("from")}T00:00:00+08:00`);
  if (sp.get("to")) q = q.lte("created_at", `${sp.get("to")}T23:59:59+08:00`);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(auditCsv((data ?? []) as AuditEvent[]), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="estafet-audit.csv"', "cache-control": "private, no-store" },
  });
}
