"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "./Button";

/** Shared body for error.tsx boundaries. Never shows raw error details to the user. */
export function ErrorState({ error, reset, title }: { error: Error & { digest?: string }; reset: () => void; title?: string }) {
  const t = useTranslations("error");
  useEffect(() => {
    console.error(error.message, error.digest);
  }, [error]);
  return (
    <div role="alert" className="mx-auto my-16 flex max-w-lg flex-col items-center gap-3 rounded-[28px] bg-warn-bg p-10 text-center">
      <TriangleAlert size={36} className="text-warn" aria-hidden="true" />
      <h1 className="m-0 text-[28px] font-medium">{title ?? t("title")}</h1>
      <p className="m-0 text-warn-ink">
        {t("body")}
        {error.digest ? <span className="mt-2 block text-[13px]">{t("reference", { digest: error.digest })}</span> : null}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>{t("retry")}</Button>
        <ButtonLink href="/" variant="outline">
          {t("home")}
        </ButtonLink>
      </div>
    </div>
  );
}
