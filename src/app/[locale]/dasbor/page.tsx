import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { ButtonLink } from "@/components/ui/Button";
import { loadDashboard } from "@/lib/db/dashboard";
import { getLabels } from "@/lib/get-labels";
import type { TFn } from "@/lib/labels";
import { PageShell } from "@/components/ui/PageShell";
import { DemoBadge } from "@/components/ui/Badge";
import { Dashboard } from "@/components/features/Dashboard";
import { VerifyEmailNotice } from "@/components/features/VerifyEmailNotice";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "dashboard" });
  return { title: tm("title") };
}

export default async function DashboardPage() {
  const user = await requireUser("/dasbor");
  const [locale, t, L] = await Promise.all([getLocale(), getTranslations("dashboard"), getLabels()]);
  const data = await loadDashboard(user.id, user.email, { t: t as unknown as TFn, L, locale });

  // First visit: a person with nothing yet is asked what they want to do. This only guides the first visit; it is not stored as a role.
  const empty = data.mine.length + data.access.length + data.sent.length + data.invitations.length === 0;
  if (empty && !(await cookies()).has("estafet_welcomed")) redirect({ href: "/mulai", locale });

  // A deletion that is waiting for its date is always visible here, with a way to cancel it.
  const supabase = await createClient();
  const { data: deletion } = await supabase
    .from("account_deletions")
    .select("scheduled_for")
    .is("cancelled_at", null)
    .is("completed_at", null)
    .maybeSingle();

  return (
    <PageShell>
      {deletion?.scheduled_for ? (
        <div
          role="status"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-warn-bg p-4 text-warn-ink"
        >
          <span>{t("deletionBanner", { date: formatDate(deletion.scheduled_for as string, locale) })}</span>
          <ButtonLink href="/akun/privasi" variant="outline" size="md">
            {t("deletionManage")}
          </ButtonLink>
        </div>
      ) : null}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-2 mt-0 text-[40px] font-medium max-sm:text-[30px]">{t("title")}</h1>
          <p className="m-0 text-text-2">{t("lead")}</p>
        </div>
        {data.hasDemo ? <DemoBadge /> : null}
      </div>
      {!user.verified ? <VerifyEmailNotice email={user.email} /> : null}
      <Dashboard data={data} />
    </PageShell>
  );
}
