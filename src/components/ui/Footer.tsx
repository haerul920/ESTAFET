import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { isProduction } from "@/lib/admin/env";
import { LanguageSwitcher } from "./LanguageSwitcher";

/** At least 44 px tall so the links are easy to tap on a phone (CLAUDE.md section 9). */
const LINK = "inline-flex min-h-11 items-center text-[#dde1e5] underline-offset-4 hover:underline";

export function Footer({ note }: { note?: string }) {
  const t = useTranslations("footer");
  // The demo sentence ("sample projects are demo data") is only true outside production.
  const fallback = isProduction() ? t("noteProduction") : t("note");
  return (
    <footer className="bg-ink text-[#dde1e5]">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-8 py-8 text-sm">
        <span className="font-semibold tracking-[0.04em] text-white">ESTAFET</span>
        <span>{note ?? fallback}</span>
        <nav aria-label={t("nav")} className="flex flex-wrap items-center gap-x-5">
          <Link href="/terms" className={LINK}>
            {t("terms")}
          </Link>
          <Link href="/privacy" className={LINK}>
            {t("privacy")}
          </Link>
          <Link href="/pedoman" className={LINK}>
            {t("guidelines")}
          </Link>
          <Link href="/atribusi" className={LINK}>
            {t("attribution")}
          </Link>
          <Link href="/kontak" className={LINK}>
            {t("contact")}
          </Link>
          <LanguageSwitcher tone="light" />
        </nav>
      </div>
    </footer>
  );
}
