import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LogoMark } from "./Logo";

export function Footer({ note }: { note?: string }) {
  const t = useTranslations("footer");
  return (
    <footer className="bg-ink text-[#dde1e5]">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-8 py-8 text-sm max-md:px-6 max-sm:flex-col max-sm:items-start max-sm:px-5 max-sm:py-6">
        <span className="inline-flex items-center gap-2.5 text-white">
          <LogoMark size={24} onSky />
          <span className="sr-only">ESTAFET</span>
        </span>
        <span>{note ?? t("note")}</span>
        <nav aria-label={t("nav")} className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/terms" className="text-[#dde1e5] underline-offset-4 hover:underline">
            {t("terms")}
          </Link>
          <Link href="/privacy" className="text-[#dde1e5] underline-offset-4 hover:underline">
            {t("privacy")}
          </Link>
          <Link href="/pedoman" className="text-[#dde1e5] underline-offset-4 hover:underline">
            {t("guidelines")}
          </Link>
          <Link href="/atribusi" className="text-[#dde1e5] underline-offset-4 hover:underline">
            {t("attribution")}
          </Link>
          <Link href="/kontak" className="text-[#dde1e5] underline-offset-4 hover:underline">
            {t("contact")}
          </Link>
          <LanguageSwitcher tone="light" />
        </nav>
      </div>
    </footer>
  );
}
