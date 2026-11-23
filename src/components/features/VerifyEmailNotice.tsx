"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { resendVerification } from "@/app/actions/auth";

/**
 * Shown while an account's email is not confirmed. Sharing a project and taking access need a confirmed email
 * (CLAUDE.md 14.3); browsing does not. The banner sits in the page flow and never covers content.
 */
export function VerifyEmailNotice({ email, compact = false }: { email: string; compact?: boolean }) {
  const t = useTranslations("verify");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-warn-bg p-4 text-warn-ink"
    >
      <span className="flex items-start gap-3">
        <MailCheck size={20} className="mt-0.5 flex-none" aria-hidden="true" />
        <span>
          <strong>{t("title")}</strong> {compact ? t("compact") : t("body", { email })}
          {message ? <span className="block text-sm">{message}</span> : null}
          {error ? <span className="block text-sm font-semibold text-danger">{error}</span> : null}
        </span>
      </span>
      <Button
        variant="outline"
        size="md"
        pending={pending}
        onClick={() =>
          start(async () => {
            setMessage("");
            setError("");
            const r = await resendVerification();
            if (r.error) setError(r.error);
            else setMessage(t("sent"));
          })
        }
      >
        {t("resend")}
      </Button>
    </div>
  );
}
