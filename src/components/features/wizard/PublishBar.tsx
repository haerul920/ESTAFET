"use client";

import { Link } from "@/i18n/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Rocket } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxField, FormMessage } from "@/components/ui/Field";
import { acceptPolicies, publishProject } from "@/app/actions/projects";

export function PublishBar({
  projectId,
  ready,
  reason,
  policiesAccepted,
  verified,
}: {
  projectId: string;
  /** Everything except the policies is done. */
  ready: boolean;
  reason: string;
  policiesAccepted: boolean;
  verified: boolean;
}) {
  const t = useTranslations("publishBar");
  const tw = useTranslations("wizard");
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [policies, setPolicies] = useState(policiesAccepted);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const canPublish = ready && verified;

  return (
    <Card className="mt-8 flex flex-col gap-4 !rounded-3xl !p-5">
      <CheckboxField
        label={t("confirm")}
        checked={confirmed}
        onChange={(e) => setConfirmed(e.target.checked)}
        disabled={!canPublish}
      />
      {!policiesAccepted ? (
        <CheckboxField
          label={t.rich("accept", {
            terms: (chunks) => <Link href="/terms">{chunks}</Link>,
            privacy: (chunks) => <Link href="/privacy">{chunks}</Link>,
          })}
          checked={policies}
          onChange={(e) => setPolicies(e.target.checked)}
          disabled={!canPublish}
        />
      ) : null}
      {!verified ? <FormMessage tone="error">{t("verifyFirst")}</FormMessage> : null}
      {!ready ? <FormMessage tone="error">{reason}</FormMessage> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex flex-wrap justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/bagikan/${projectId}/tim`} variant="outline">
            {t("back")}
          </ButtonLink>
          <ButtonLink href="/dasbor" variant="outline">
            {tw("saveDraft")}
          </ButtonLink>
        </div>
        <Button
          size="md"
          disabled={!canPublish || !confirmed || !policies || pending}
          onClick={() =>
            start(async () => {
              setError("");
              if (!policiesAccepted) {
                const a = await acceptPolicies(projectId);
                if (a.error) {
                  setError(a.error);
                  return;
                }
                router.refresh();
              }
              const res = await publishProject(projectId);
              if (res?.error) setError(res.error);
            })
          }
        >
          <Rocket size={18} aria-hidden="true" />
          {pending ? t("publishing") : t("publish")}
        </Button>
      </div>
      <p className="m-0 text-[13px] text-text-2">
        {t("note")}
      </p>
    </Card>
  );
}
