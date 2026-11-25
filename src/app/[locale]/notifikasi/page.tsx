import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { loadNotifications } from "@/lib/db/dashboard";
import type { TFn } from "@/lib/labels";
import { PageShell } from "@/components/ui/PageShell";
import { NotificationsList } from "@/components/features/NotificationsList";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "dashboard" });
  return { title: tm("notifications"), robots: { index: false } };
}

export default async function NotificationsPage() {
  const user = await requireUser("/notifikasi");
  const [locale, t] = await Promise.all([getLocale(), getTranslations("dashboard")]);
  const items = await loadNotifications(user.id, { t: t as unknown as TFn, locale }, user.email);

  return (
    <PageShell width={820}>
      <NotificationsList items={items} />
    </PageShell>
  );
}
