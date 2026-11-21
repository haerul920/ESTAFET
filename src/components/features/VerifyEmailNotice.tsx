"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { resendVerification } from "@/app/actions/auth";

/**
 * Shown while an account's email is not confirmed. Sharing a project and taking access need a confirmed email
 * (CLAUDE.md 14.3); browsing does not. The banner sits in the page flow and never covers content.
 */
export function VerifyEmailNotice({ email, compact = false }: { email: string; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-warn-bg p-4 text-warn-ink">
      <span className="flex items-start gap-3">
        <MailCheck size={20} className="mt-0.5 flex-none" aria-hidden="true" />
        <span>
          <strong>Verify your email address.</strong>{" "}
          {compact
            ? "You need a confirmed email for this."
            : `We sent a link to ${email}. Until you confirm it, you can browse but you cannot share a project or take access.`}
          {message ? <span className="block text-sm">{message}</span> : null}
          {error ? <span className="block text-sm font-semibold text-danger">{error}</span> : null}
        </span>
      </span>
      <Button
        variant="outline"
        size="md"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMessage("");
            setError("");
            const r = await resendVerification();
            if (r.error) setError(r.error);
            else setMessage("A new link is on its way. Check your inbox and spam folder.");
          })
        }
      >
        Send the link again
      </Button>
    </div>
  );
}
