"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { ReasonAction } from "./ReasonDialog";
import { regenerateConsent } from "@/app/admin/actions";

/** Regenerate an advisor link (shown once) and copy a short reminder message the creator can send. */
export function ConsentActions({ projectId, projectTitle, advisorName }: { projectId: string; projectTitle: string; advisorName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "text" | null>(null);

  const message = (link?: string) =>
    `Hello ${advisorName || "there"}, your student asked you to approve sharing "${projectTitle}" on ESTAFET so a new team can continue it. ` +
    (link ? `Please open this private link (one decision, it expires): ${link} ` : "The earlier link is no longer valid, so please ask the student for a new one. ") +
    "Thank you.";

  async function copy(kind: "link" | "text", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <ReasonAction
          small
          label="Regenerate link"
          consequence={<>A new private link is created and shown once. The old pending link stops working. The advisor name and project stay the same.</>}
          action={(reason) => regenerateConsent(projectId, reason)}
          onDone={(data) => typeof data?.url === "string" && setUrl(data.url)}
          successMessage="New link created. Copy it now: it is shown once."
        />
        <button type="button" onClick={() => copy("text", message(url ?? undefined))} className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-white px-3.5 text-[13px] font-semibold hover:bg-surface">
          {copied === "text" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} Copy reminder text
        </button>
      </div>
      {url ? (
        <div className="rounded-2xl bg-warn-bg p-3 text-sm text-warn-ink">
          <strong>New link (shown once):</strong>
          <div className="mt-1 break-all font-code text-[12px]">{url}</div>
          <button type="button" onClick={() => copy("link", url)} className="mt-2 cursor-pointer font-semibold text-blue">
            {copied === "link" ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
