import { useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { Link } from "@/i18n/navigation";

/** Says plainly that an AI translated the text, and gives the owners' own words one click away. */
export function TranslationNote({ slug, original }: { slug: string; original: boolean }) {
  const t = useTranslations("translation");
  return (
    <p className="mb-4 mt-0 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[14px] bg-blue-tint px-4 py-2.5 text-sm">
      <Languages size={16} aria-hidden="true" className="flex-none text-blue-dark" />
      <span>{original ? t("showingOriginal") : t("translated")}</span>
      <Link href={original ? `/projects/${slug}` : `/projects/${slug}?original=1`} className="font-semibold">
        {original ? t("seeTranslation") : t("seeOriginal")}
      </Link>
    </p>
  );
}
