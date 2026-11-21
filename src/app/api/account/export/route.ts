import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Downloads the signed-in person's own data as JSON (data portability). The SQL function `export_my_data` reads only
 * rows that belong to the caller and leaves out other people's personal data and file contents.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("export_my_data");
  if (error || !data) return NextResponse.json({ error: "export_failed" }, { status: 500 });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="estafet-data-${stamp}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
