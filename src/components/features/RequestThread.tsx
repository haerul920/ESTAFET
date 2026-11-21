"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/Field";
import { postRequestMessage } from "@/app/actions/engage";
import { cn } from "@/lib/cn";

export interface ThreadMessage {
  id: string;
  authorName: string;
  mine: boolean;
  fromOwner: boolean;
  body: string;
  whenLabel: string;
}

const MAX = 500;

/** A short conversation between the requesting team and the owners. Closed once the request is decided. */
export function RequestThread({ requestId, messages, open }: { requestId: string; messages: ThreadMessage[]; open: boolean }) {
  const t = useTranslations("thread");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const left = MAX - body.length;

  return (
    <Card as="section" aria-labelledby="thread-h" className="flex flex-col gap-4">
      <div>
        <h2 id="thread-h" className="mb-1 mt-0 text-[22px]">
          {t("title")}
        </h2>
        <p className="m-0 text-sm text-text-2">{open ? t("hint") : t("closed")}</p>
      </div>
      {messages.length === 0 ? (
        <p className="m-0 text-[15px] text-text-3">{t("empty")}</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0" aria-live="polite">
          {messages.map((m) => (
            <li key={m.id} className={cn("item-in flex flex-col gap-0.5 rounded-[18px] p-3.5 text-[15px]", m.mine ? "ml-6 bg-blue-tint" : "mr-6 bg-white")}>
              <span className="text-[13px] text-text-2">
                <strong className="text-ink">{m.mine ? t("you") : m.authorName}</strong> · {m.fromOwner ? t("owner") : t("team")} · {m.whenLabel}
              </span>
              <span className="whitespace-pre-wrap">{m.body}</span>
            </li>
          ))}
        </ol>
      )}
      {open ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setError("");
              const r = await postRequestMessage(requestId, body);
              if (r.error) {
                setError(r.error);
                return;
              }
              setBody("");
              router.refresh();
            });
          }}
        >
          <label htmlFor="thread-body" className="text-sm font-semibold">
            {t("label")}
          </label>
          <textarea
            id="thread-body"
            rows={3}
            value={body}
            maxLength={MAX}
            onChange={(e) => setBody(e.target.value)}
            className="w-full resize-y rounded-[14px] border border-line-strong bg-white px-3.5 py-3 text-base"
          />
          <span className={cn("text-[13px]", left < 40 ? "text-warn" : "text-text-2")}>{t("left", { count: left })}</span>
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}
          <div>
            <Button type="submit" variant="outlineBlue" disabled={pending || body.trim().length === 0}>
              {pending ? t("sending") : t("send")}
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
