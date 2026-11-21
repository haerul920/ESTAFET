import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Footer({ note }: { note?: string }) {
  const t = useTranslations("footer");
  return (
    <footer className="bg-ink text-[#dde1e5]">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-8 py-8 text-sm">
        <span className="font-semibold tracking-[0.04em] text-white">ESTAFET</span>
        <span>{note ?? t("note")}</span>
        <nav aria-label={t("nav")} className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href="/terms" className="text-[#dde1e5] underline-offset-4 hover:underline">
            {t("terms")}
          </Link>
          <Link href="/privacy" className="text-[#dde1e5] underline-offset-4 hover:underline">
            {t("privacy")}
          </Link>
          <LanguageSwitcher tone="light" />
        </nav>
      </div>
    </footer>
  );
}
