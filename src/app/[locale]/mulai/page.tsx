import type { Metadata } from "next";
import { ArrowRight, Compass, Share2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { PageShell } from "@/components/ui/PageShell";
import { MarkWelcomed } from "@/components/features/MarkWelcomed";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "welcome" });
  return { title: tm("metaTitle"), robots: { index: false } };
}

/**
 * First-run screen. It only guides the first visit. Nothing chosen here is stored as a role:
 * the same account can share projects and continue other people's projects at any time.
 */
export default async function StartPage() {
  await requireUser("/mulai");
  const t = await getTranslations("welcome");
  const cards = [
    { href: "/bagikan", icon: <Share2 size={28} aria-hidden="true" />, title: t("shareTitle"), text: t("shareText") },
    {
      href: "/explore",
      icon: <Compass size={28} aria-hidden="true" />,
      title: t("exploreTitle"),
      text: t("exploreText"),
    },
  ];
  return (
    <PageShell width={880}>
      <MarkWelcomed />
      <h1 className="mb-2 mt-0 text-[40px] font-medium max-sm:text-[30px]">{t("title")}</h1>
      <p className="mb-8 mt-0 max-w-[560px] text-text-2">{t("lead")}</p>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5 p-0">
        {cards.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="flex h-full flex-col gap-3 rounded-[28px] border border-line-soft bg-surface p-7 text-ink no-underline transition-transform hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(10,60,150,0.12)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime text-ink">{c.icon}</span>
              <span className="text-[24px] font-medium">{c.title}</span>
              <span className="text-text-2">{c.text}</span>
              <span className="mt-auto flex items-center gap-2 font-semibold text-blue-dark">
                {t("start")} <ArrowRight size={18} aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mb-0 mt-8 text-sm">
        <Link href="/dasbor">{t("skip")}</Link>
      </p>
    </PageShell>
  );
}
