"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/ui/ErrorState";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("admin.common");
  return <ErrorState error={error} reset={reset} title={t("loadFailed")} />;
}
