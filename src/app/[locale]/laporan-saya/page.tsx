import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { PageShell } from "@/components/ui/PageShell";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "myReports" });
  return { title: tm("metaTitle"), robots: { index: false } };
}

type Status = "open" | "in_review" | "resolved" | "dismissed";
const TONE = { open: "info", in_review: "warn", resolved: "ok", dismissed: "neutral" } as const;

/** The reports a signed-in person sent, with their status. Reporters see their own reports only. */
export default async function MyReportsPage() {
  await requireUser("/laporan-saya");
  const [locale, t, tr, tn] = await Promise.all([
    getLocale(),
    getTranslations("myReports"),
    getTranslations("report"),
    getTranslations("nav"),
  ]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("my_reports_v")
    .select("reference, reason, status, created_at, project_title, project_slug")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as {
    reference: string;
    reason: string;
    status: Status;
    created_at: string;
    project_title: string;
    project_slug: string;
  }[];

  return (
    <PageShell width={820}>
      <h1 className="mb-2 mt-0 text-4xl font-medium max-sm:text-[28px]">{t("title")}</h1>
      <p className="mb-6 mt-0 max-w-[620px] text-text-2">{t("lead")}</p>
      {rows.length === 0 ? (
        <Card tone="dashed" className="flex flex-col items-center gap-3 text-center">
          <h2 className="m-0 text-xl">{t("emptyTitle")}</h2>
          <p className="m-0 max-w-[460px] text-text-2">{t("emptyText")}</p>
          <ButtonLink href="/explore" variant="outline">
            {tn("explore")}
          </ButtonLink>
        </Card>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((r) => (
            <li key={r.reference} className="item-in">
              <Card className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={`/projects/${r.project_slug}`}
                    className="text-lg font-semibold text-ink no-underline hover:underline"
                  >
                    {r.project_title}
                  </Link>
                  <Badge tone={TONE[r.status]}>{t(`status.${r.status}`)}</Badge>
                </div>
                <p className="m-0 text-[15px] text-text-3">{t(`explain.${r.status}`)}</p>
                <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-2">
                  <span>{tr(`r.${r.reason}`)}</span>
                  <span>
                    {t("reference")}: <code className="font-code">{r.reference}</code>
                  </span>
                  <span>{t("sent", { date: formatDate(r.created_at, locale) })}</span>
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
