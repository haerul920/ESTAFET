import type { Metadata } from "next";
import { DM_Mono, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/ui/Providers";
import { getSettings } from "@/lib/settings";
import "./globals.css";

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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "ESTAFET: pass the baton on student projects", template: "%s · ESTAFET" },
  description:
    "ESTAFET turns discontinued student projects into verified starting points, so the next team builds in week one instead of digging through old drives.",
  openGraph: {
    title: "ESTAFET: pass the baton on student projects",
    description: "Structured handover of discontinued student competition and research projects at Universitas Hasanuddin.",
    type: "website",
    siteName: "ESTAFET",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const showBanner = (await getSettings()).show_demo_banner.value;
  return (
    <html lang="en" className={`${instrument.variable} ${dmMono.variable} ${jetbrains.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-lime focus:px-5 focus:py-3 focus:font-semibold focus:text-black"
        >
          Skip to content
        </a>
        {showBanner ? (
          <div role="note" className="bg-warn-bg px-4 py-1.5 text-center text-[13px] font-semibold text-warn-ink">
            Demo environment: sample projects are simulated demo data.
          </div>
        ) : null}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
