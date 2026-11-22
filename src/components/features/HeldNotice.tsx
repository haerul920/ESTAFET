import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/ui/PageShell";

/**
 * Shown instead of a project that is being held. Neutral on purpose: it says nothing about who reported what,
 * why, or which project it was. A hold is temporary and is reviewed by the team.
 */
export function HeldNotice() {
  const t = useTranslations("held");
  return (
    <PageShell>
      <Card tone="warn" className="mx-auto mt-6 flex max-w-[640px] flex-col gap-3">
        <h1 className="m-0 flex items-center gap-2 text-2xl">
          <ShieldAlert size={24} aria-hidden="true" /> {t("title")}
        </h1>
        <p className="m-0 text-[15px]">{t("text")}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/explore" arrow>
            {t("explore")}
          </ButtonLink>
          <ButtonLink href="/kontak" variant="outline">
            {t("contact")}
          </ButtonLink>
        </div>
      </Card>
    </PageShell>
  );
}
