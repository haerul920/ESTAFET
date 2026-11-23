"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/Field";
import { appealDecision } from "@/app/actions/moderation";
import { cn } from "@/lib/cn";

/** The appeal form for one decision. A decision can be appealed once. */
export function AppealForm({ decisionId, slug }: { decisionId: string; slug: string }) {
  const t = useTranslations("decision.appeal");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const length = body.trim().length;
  const ok = length >= 20 && length <= 1500;

  if (sent) {
    return (
      <Card tone="blue">
        <FormMessage tone="success">{t("sent")}</FormMessage>
      </Card>
    );
  }

  return (
    <Card as="section" aria-labelledby="appeal-h" className="flex flex-col gap-3">
      <h2 id="appeal-h" className="m-0 text-xl">
        {t("title")}
      </h2>
      <p className="m-0 text-[15px] text-text-3">{t("text")}</p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError("");
            const r = await appealDecision(decisionId, slug, body);
            if (r.error) {
              setError(r.error);
              return;
            }
            setSent(true);
            router.refresh();
          });
        }}
      >
        <label htmlFor="appeal-body" className="text-sm font-semibold">
          {t("label")}
        </label>
        <textarea
          id="appeal-body"
          rows={5}
          value={body}
          maxLength={1500}
          onChange={(e) => setBody(e.target.value)}
          aria-describedby="appeal-hint"
          className="w-full resize-y rounded-[14px] border border-line-strong bg-white px-3.5 py-3 text-base"
        />
        <span id="appeal-hint" className={cn("text-[13px]", ok ? "text-ok" : "text-text-2")}>
          {t("hint")} ({length})
        </span>
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <div>
          <Button type="submit" disabled={pending || !ok} pending={pending}>
            {pending ? t("sending") : t("send")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
