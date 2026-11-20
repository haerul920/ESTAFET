"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { createConsentLink } from "@/app/actions/projects";

/**
 * Generates a fresh private advisor link and copies it. A new link replaces the previous pending one,
 * because only the hash is stored and the original cannot be shown again.
 */
export function CopyLinkButton({
  projectId,
  label = "Copy consent link",
  onUrl,
}: {
  projectId: string;
  label?: string;
  onUrl?: (url: string) => void;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const [message, setMessage] = useState("");

  function run() {
    start(async () => {
      const res = await createConsentLink(projectId);
      if (!res.url) {
        setState("error");
        setMessage(res.error ?? "Could not create the link.");
        return;
      }
      onUrl?.(res.url);
      try {
        await navigator.clipboard.writeText(res.url);
        setState("copied");
        setMessage("Link copied. Any earlier link no longer works.");
      } catch {
        setState("copied");
        setMessage("Link created. Copy it from the box on the Consent step.");
      }
      setTimeout(() => setState("idle"), 4000);
    });
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 text-sm font-semibold text-blue disabled:opacity-60"
      >
        {state === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        {pending ? "Creating link…" : state === "copied" ? "Copied" : label}
      </button>
      <span role="status" className={`text-[13px] ${state === "error" ? "text-danger" : "text-text-2"}`}>
        {message}
      </span>
    </span>
  );
}
