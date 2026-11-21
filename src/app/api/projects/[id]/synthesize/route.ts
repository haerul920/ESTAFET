import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { apiLocale } from "@/i18n/api";
import { getCurrentUser } from "@/lib/auth";
import { getOwnedProject } from "@/lib/db/owner";
import { runSynthesis } from "@/lib/synthesis";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Starts a synthesis run for a project the signed-in user creates. The work lives in lib/synthesis.ts. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const locale = apiLocale(req);
  const errs = await getTranslations({ locale, namespace: "errors" });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: errs("signIn") }, { status: 401 });
  if (user.suspended) return NextResponse.json({ error: errs("suspended") }, { status: 403 });

  const project = await getOwnedProject(projectId);
  if (!project) return NextResponse.json({ error: errs("forbidden") }, { status: 403 });

  const result = await runSynthesis(projectId, user.id, locale);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, runId: result.runId, mode: result.mode, items: result.items });
}
