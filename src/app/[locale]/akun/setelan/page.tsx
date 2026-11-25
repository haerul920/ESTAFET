import type { Metadata } from "next";
import { Download } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { initials, requireUser } from "@/lib/auth";
import { avatarSrc } from "@/lib/account/avatar";
import { ProfileSettings } from "@/components/features/ProfileSettings";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DeletionControls } from "@/components/features/DeletionControls";
import { EmailPreferences } from "@/components/features/EmailPreferences";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "account" });
  return { title: tm("metaTitle"), robots: { index: false } };
}

const LISTED = ["l1", "l2", "l3", "l4", "l5"] as const;

/**
 * Settings: your photo, name and email, then your data. You can download a copy, choose email notifications, or
 * schedule the deletion of your account (30 day grace period).
 */
export default async function SettingsPage() {
  const user = await requireUser("/akun/setelan");
  const [locale, t, td, te] = await Promise.all([
    getLocale(),
    getTranslations("account"),
    getTranslations("account.delete"),
    getTranslations("account.email"),
  ]);
  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("account_deletions")
    .select("scheduled_for")
    .is("cancelled_at", null)
    .is("completed_at", null)
    .maybeSingle();
  const scheduledFor = (pending?.scheduled_for as string | undefined) ?? null;
  const { data: prefs } = await supabase.from("profiles").select("email_notifications, locale").maybeSingle();
  const emailOn = prefs?.email_notifications !== false;
  const emailLocale = prefs?.locale === "en" ? "en" : "id";

  return (
    <PageShell width={820}>
      <h1 className="mb-2 mt-0 text-4xl font-medium max-sm:text-[28px]">{t("title")}</h1>
      <p className="mb-6 mt-0 max-w-[620px] text-text-2">{t("lead")}</p>

      <div className="flex flex-col gap-6">
        <ProfileSettings
          name={user.profile?.full_name ?? ""}
          email={user.email}
          initials={initials(user.profile?.full_name || user.email)}
          photo={avatarSrc(user.id, user.profile?.avatar_url)}
        />

        <Card as="section" aria-labelledby="export-h" className="flex flex-col gap-3">
          <h2 id="export-h" className="m-0 text-xl">
            {t("export.title")}
          </h2>
          <p className="m-0 text-[15px] text-text-3">{t("export.text")}</p>
          <div>
            {/* A plain link to the route handler: the browser downloads the file. */}
            <ButtonLink href="/api/account/export" variant="outlineBlue" download prefetch={false}>
              <Download size={18} aria-hidden="true" /> {t("export.button")}
            </ButtonLink>
          </div>
        </Card>

        <Card as="section" aria-labelledby="email-h" className="flex flex-col gap-3">
          <h2 id="email-h" className="m-0 text-xl">
            {te("title")}
          </h2>
          <p className="m-0 text-[15px] text-text-3">{te("text")}</p>
          <EmailPreferences enabled={emailOn} locale={emailLocale} />
        </Card>

        <Card as="section" aria-labelledby="delete-h" className="flex flex-col gap-3">
          <h2 id="delete-h" className="m-0 text-xl">
            {td("title")}
          </h2>
          {scheduledFor ? (
            <p role="status" className="m-0 rounded-[14px] bg-warn-bg p-3.5 text-[15px] text-warn-ink">
              {td("scheduled", { date: formatDate(scheduledFor, locale) })}
            </p>
          ) : null}
          <p className="m-0 text-[15px] text-text-3">{td("intro")}</p>
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[15px] text-text-3">
            {LISTED.map((k) => (
              <li key={k}>{td(k)}</li>
            ))}
          </ul>
          <div>
            <DeletionControls scheduled={Boolean(scheduledFor)} />
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
