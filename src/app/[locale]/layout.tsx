import type { Metadata } from "next";
import { DM_Mono, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MotionRuntime } from "@/components/ui/MotionRuntime";
import { UiProviders } from "@/components/ui/UiProviders";
import { getSettings } from "@/lib/settings";
import { isProduction } from "@/lib/admin/env";
import { routing } from "@/i18n/routing";
import "../globals.css";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument",
  display: "swap",
});
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-jetbrains",
  display: "swap",
});

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    title: { default: t("title"), template: "%s · ESTAFET" },
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("ogDescription"),
      type: "website",
      siteName: "ESTAFET",
      locale: locale === "id" ? "id_ID" : "en_GB",
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("layout");
  // The demo banner never shows in production: demo data and mock AI are refused there (CLAUDE.md 14.2).
  const showBanner = !isProduction() && (await getSettings()).show_demo_banner.value;

  return (
    <html lang={locale} className={`${instrument.variable} ${dmMono.variable} ${jetbrains.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-system-banner focus:rounded-full focus:bg-lime focus:px-5 focus:py-3 focus:font-semibold focus:text-black"
        >
          {t("skip")}
        </a>
        {showBanner ? (
          <div role="note" className="bg-warn-bg px-4 py-1.5 text-center text-[13px] font-semibold text-warn-ink">
            {t("demoBanner")}
          </div>
        ) : null}
        <NextIntlClientProvider>
          <MotionRuntime>
            <UiProviders>{children}</UiProviders>
          </MotionRuntime>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
