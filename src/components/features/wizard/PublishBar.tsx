"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [policies, setPolicies] = useState(policiesAccepted);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const canPublish = ready && verified;

  return (
    <Card className="mt-8 flex flex-col gap-4 !rounded-3xl !p-5">
      <CheckboxField
        label="The preview above is what I want to make public. My team agrees, the advisor step is done, and no private details are in it."
        checked={confirmed}
        onChange={(e) => setConfirmed(e.target.checked)}
        disabled={!canPublish}
      />
      {!policiesAccepted ? (
        <CheckboxField
          label={
            <>
              I accept the current <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
            </>
          }
          checked={policies}
          onChange={(e) => setPolicies(e.target.checked)}
          disabled={!canPublish}
        />
      ) : null}
      {!verified ? <FormMessage tone="error">Verify your email address first. Publishing needs a confirmed email.</FormMessage> : null}
      {!ready ? <FormMessage tone="error">{reason}</FormMessage> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex flex-wrap justify-between gap-3">
        <ButtonLink href={`/share/${projectId}/verify`} variant="outline">
          Back to review
        </ButtonLink>
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
          {pending ? "Publishing…" : "Publish teaser"}
        </Button>
      </div>
      <p className="m-0 text-[13px] text-text-2">
        Only the teaser becomes public. Your files stay private and open only to people who hold access.
      </p>
    </Card>
  );
}
