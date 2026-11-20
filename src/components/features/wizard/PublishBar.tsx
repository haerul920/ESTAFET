"use client";

import { useState, useTransition } from "react";
import { Rocket } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxField, FormMessage } from "@/components/ui/Field";
import { publishProject } from "@/app/actions/projects";

export function PublishBar({ projectId, ready, reason }: { projectId: string; ready: boolean; reason: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <Card className="mt-8 flex flex-col gap-4 !rounded-3xl !p-5">
      <CheckboxField
        label="The preview above is what I want to make public. My team and advisor agree, and no private details are in it."
        checked={confirmed}
        onChange={(e) => setConfirmed(e.target.checked)}
        disabled={!ready}
      />
      {!ready ? <FormMessage tone="error">{reason}</FormMessage> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex flex-wrap justify-between gap-3">
        <ButtonLink href={`/share/${projectId}/verify`} variant="outline">
          Back to review
        </ButtonLink>
        <Button
          size="md"
          disabled={!ready || !confirmed || pending}
          onClick={() =>
            start(async () => {
              setError("");
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
        Only the teaser becomes public. Your files stay private and unlock only after you approve a request.
      </p>
    </Card>
  );
}
