import { Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui/PageShell";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <PageShell width={720}>
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Compass size={44} className="text-blue" aria-hidden="true" />
        <p className="mono-label m-0 text-text-2">{t("code")}</p>
        <h1 className="m-0 text-[40px] font-medium">{t("title")}</h1>
        <p className="m-0 max-w-md text-text-2">{t("body")}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/explore" arrow>
            {t("explore")}
          </ButtonLink>
          <ButtonLink href="/" variant="outline">
            {t("home")}
          </ButtonLink>
        </div>
      </div>
    </PageShell>
  );
}
