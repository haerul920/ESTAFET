"use client";

import { useTranslations } from "next-intl";
import { ReasonAction } from "./ReasonDialog";
import { purgeDemoData } from "@/app/[locale]/admin/actions";

export function PurgeControl({ blocked, env }: { blocked: boolean; env: string }) {
  const t = useTranslations("admin.purge");
  const code = (chunks: React.ReactNode) => <code className="font-code">{chunks}</code>;
  if (blocked) {
    return <p className="m-0 rounded-2xl bg-white p-3 text-sm text-text-2">{t("blocked", { env })}</p>;
  }
  return (
    <ReasonAction
      label={t("label")}
      tone="danger"
      typedPhrase={t("phrase")}
      consequence={
        <ul className="m-0 list-disc pl-5">
          <li>{t("c1")}</li>
          <li>{t("c2")}</li>
          <li>{t.rich("c3", { code })}</li>
        </ul>
      }
      action={purgeDemoData}
      successMessage={t("done")}
    />
  );
}
