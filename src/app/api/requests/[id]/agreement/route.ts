import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestDetail } from "@/lib/db/requests";
import { AgreementDocument } from "@/lib/agreement/pdf";
import { AGREEMENT_TERM_KEYS, AGREEMENT_VERSION, creditLine } from "@/lib/agreement/terms";
import { formatDate } from "@/lib/format";
import { apiLocale } from "@/i18n/api";
import type { TFn } from "@/lib/labels";

export const runtime = "nodejs";

/** Agreement PDF, in the language of the page (?lang=). Only for owners and people on the request, and only once somebody accepted. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = apiLocale(req);
  const [api, errors, pdf, ag] = (await Promise.all([
    getTranslations({ locale, namespace: "api" }),
    getTranslations({ locale, namespace: "errors" }),
    getTranslations({ locale, namespace: "pdf" }),
    getTranslations({ locale, namespace: "agreement" }),
  ])) as unknown as [TFn, TFn, TFn, TFn];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: errors("signIn") }, { status: 401 });

  const d = await getRequestDetail(id, user.id);
  if (!d || (!d.isOwner && !d.isTeam)) return NextResponse.json({ error: api("notFound") }, { status: 404 });
  if (!d.unlocked) return NextResponse.json({ error: api("agreementNotReady") }, { status: 409 });

  const { data: teamProfiles } = await supabase.from("profiles").select("full_name").eq("id", d.request.created_by);
  const adopters = [teamProfiles?.[0]?.full_name ?? d.requesterName, ...d.request.members.map((m) => m.email)];
  const lineageId = d.request.id.slice(0, 8);

  // AgreementDocument returns the <Document> element that renderToBuffer expects.
  const buffer = await renderToBuffer(
    AgreementDocument({
      data: {
        projectTitle: d.project.title,
        owners: d.ownerNames,
        adopterTeam: d.request.adopter_team_name,
        adopters,
        tasks: d.tasks.length > 0 ? d.tasks.map((t) => t.title) : [pdf("noTasks")],
        accepted: d.holders.map((h) => ({ name: h.name, at: formatDate(h.acceptedAt, locale) })),
        lineageId,
        creditLine: creditLine({ title: d.project.title, creators: d.ownerNames, lineageId }, ag),
        isDemo: d.project.is_demo,
        labels: {
          title: pdf("title"),
          version: pdf("version", { version: AGREEMENT_VERSION }),
          demoNote: pdf("demoNote"),
          project: pdf("project"),
          owners: pdf("owners"),
          notListed: pdf("notListed"),
          team: pdf("team"),
          members: pdf("members"),
          tasks: pdf("tasks"),
          terms: pdf("terms"),
          acceptedBy: pdf("acceptedBy"),
          credit: pdf("credit"),
          lineageRef: pdf("lineageRef", { id: lineageId }),
          disclaimer: ag("disclaimer"),
          termTexts: AGREEMENT_TERM_KEYS.map((k) => ag(k)),
        },
      },
    }),
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${pdf("fileName", { slug: d.project.slug })}"`,
      "cache-control": "private, no-store",
    },
  });
}
