import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/ui/PageShell";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "suspended" });
  return { title: tm("metaTitle"), robots: { index: false } };
}

export default async function SuspendedPage() {
  const [user, settings, locale, t] = await Promise.all([
    getCurrentUser(),
    getSettings(),
    getLocale(),
    getTranslations("suspended"),
  ]);
  const contact = settings.contact_email.value;
  const until = user?.profile?.suspended_until;
  return (
    <PageShell width={620}>
      <div role="alert" className="flex flex-col items-center gap-3 rounded-[28px] bg-warn-bg p-10 text-center">
        <ShieldAlert size={40} className="text-warn" aria-hidden="true" />
        <h1 className="m-0 text-[30px] font-medium">{t("title")}</h1>
        <p className="m-0 text-warn-ink">
          {until ? t("until", { date: formatDate(until, locale) }) : ""}
          {t("text")}
        </p>
        {user?.profile?.suspended_reason ? (
          <p className="m-0 text-sm text-warn-ink">{t("reason", { reason: user.profile.suspended_reason })}</p>
        ) : null}
        <p className="m-0 text-warn-ink">
          {contact ? (
            <>
              {t("contactPre")}
              <a href={`mailto:${contact}`}>{contact}</a>.
            </>
          ) : (
            t("contactDefault")
          )}
        </p>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            {t("signOut")}
          </Button>
        </form>
      </div>
    </PageShell>
  );
}
