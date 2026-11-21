import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadDashboard } from "@/lib/db/dashboard";
import { PageShell } from "@/components/ui/PageShell";
import { DemoBadge } from "@/components/ui/Badge";
import { Dashboard } from "@/components/features/Dashboard";
import { VerifyEmailNotice } from "@/components/features/VerifyEmailNotice";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser("/dasbor");
  const data = await loadDashboard(user.id, user.email);

  // First visit: a person with nothing yet is asked what they want to do. This only guides the first visit; it is not stored as a role.
  const empty = data.mine.length + data.access.length + data.sent.length + data.invitations.length === 0;
  if (empty && !(await cookies()).has("estafet_welcomed")) redirect("/mulai");

  return (
    <PageShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-2 mt-0 text-[40px] font-medium max-sm:text-[30px]">Dashboard</h1>
          <p className="m-0 text-text-2">Everything waiting on you, in one place.</p>
        </div>
        {data.hasDemo ? <DemoBadge /> : null}
      </div>
      {!user.verified ? <VerifyEmailNotice email={user.email} /> : null}
      <Dashboard data={data} />
    </PageShell>
  );
}
