import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { loadDashboard } from "@/lib/db/dashboard";
import { PageShell } from "@/components/ui/PageShell";
import { DemoBadge } from "@/components/ui/Badge";
import { Dashboard } from "@/components/features/Dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser("/dashboard");
  const { tab } = await searchParams;
  const data = await loadDashboard(user.id, user.email);
  return (
    <PageShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-2 mt-0 text-[40px] font-medium max-sm:text-[30px]">Dashboard</h1>
          <p className="m-0 text-text-2">Everything waiting on you, in one place.</p>
        </div>
        {data.hasDemo ? <DemoBadge /> : null}
      </div>
      <Dashboard data={data} initialTab={tab ?? "projects"} />
    </PageShell>
  );
}
