import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getRequestDetail } from "@/lib/db/requests";
import { AgreementDocument } from "@/lib/agreement/pdf";
import { creditLine } from "@/lib/agreement/terms";
import { formatDate } from "@/lib/labels";

export const runtime = "nodejs";

/** Agreement PDF. Only for people on the request, and only once both sides accepted. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const d = await getRequestDetail(id, user.id);
  if (!d || (!d.isCreator && !d.isTeam)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!d.unlocked) return NextResponse.json({ error: "The agreement PDF is available after both sides accept." }, { status: 409 });

  const { data: teamProfiles } = await supabase.from("profiles").select("full_name").eq("id", d.request.created_by);
  const adopters = [teamProfiles?.[0]?.full_name ?? d.requesterName, ...d.request.members.map((m) => m.email)];

  // AgreementDocument returns the <Document> element that renderToBuffer expects.
  const buffer = await renderToBuffer(
    AgreementDocument({
      data: {
        projectTitle: d.project.title,
        creators: d.creatorNames,
        advisor: d.project.advisor_name,
        adopterTeam: d.request.adopter_team_name,
        adopters,
        tasks: d.tasks.map((t) => t.title),
        creatorAccepted: d.acceptances.filter((a) => a.side === "creator").map((a) => ({ name: a.name, at: formatDate(a.accepted_at) })),
        adopterAccepted: d.acceptances.filter((a) => a.side === "adopter").map((a) => ({ name: a.name, at: formatDate(a.accepted_at) })),
        lineageId: d.request.id.slice(0, 8),
        creditLine: creditLine({ title: d.project.title, creators: d.creatorNames, advisor: d.project.advisor_name, lineageId: d.request.id.slice(0, 8) }),
        isDemo: d.project.is_demo,
      },
    }),
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="estafet-agreement-${d.project.slug}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
