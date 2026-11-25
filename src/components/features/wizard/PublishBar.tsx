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
import { SaveExitButton } from "./SaveExit";
import { WizardActions } from "./WizardActions";

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
            terms: (chunks) => (
              <Link
                href="/terms"
                className="link-anim inline-flex items-center rounded-md px-1.5 py-0.5 font-semibold text-blue underline decoration-blue/35 decoration-1 underline-offset-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-tint hover:text-blue-dark hover:decoration-blue-dark"
              >
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link
                href="/privacy"
                className="link-anim inline-flex items-center rounded-md px-1.5 py-0.5 font-semibold text-blue underline decoration-blue/35 decoration-1 underline-offset-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-tint hover:text-blue-dark hover:decoration-blue-dark"
              >
                {chunks}
              </Link>
            ),
          })}
          checked={policies}
          onChange={(e) => setPolicies(e.target.checked)}
          disabled={!canPublish}
        />
      ) : null}
      {!verified ? <FormMessage tone="error">{t("verifyFirst")}</FormMessage> : null}
      {!ready ? <FormMessage tone="error">{reason}</FormMessage> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <WizardActions
        left={
          <ButtonLink href={`/bagikan/${projectId}/tim`} variant="outline" size="lg">
            {t("back")}
          </ButtonLink>
        }
      >
        <SaveExitButton />
        <Button
          size="lg"
          loading={pending}
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
      </WizardActions>
      <p className="m-0 text-[13px] text-text-2">{t("note")}</p>
    </Card>
  );
}
