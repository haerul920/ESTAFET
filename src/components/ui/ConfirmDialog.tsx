"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { Dialog, DialogContent, DialogTrigger } from "./Dialog";
import { FormMessage } from "./Field";

/**
 * A button that opens a confirmation dialog. The dialog says in plain words what will happen, can ask for a
 * written reason (at least `minReason` characters), and shows the error from the server instead of closing.
 * Built on the Radix Dialog wrapper: focus is trapped and returns to the button.
 */
export function ConfirmDialog({
  trigger,
  title,
  effect,
  confirmLabel,
  tone = "primary",
  triggerVariant = "outline",
  reasonLabel,
  minReason = 0,
  onConfirm,
  onDone,
  disabled,
  size = "md",
}: {
  trigger: string;
  title: string;
  /** What will change, in plain words. */
  effect: React.ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  triggerVariant?: "outline" | "danger" | "primary" | "outlineBlue";
  reasonLabel?: string;
  minReason?: number;
  onConfirm: (reason: string) => Promise<{ error?: string }>;
  onDone?: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const t = useTranslations("ui");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const reasonOk = minReason === 0 || reason.trim().length >= minReason;

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setReason("");
      setError("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={size} disabled={disabled}>
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent title={title} showClose={false}>
        <div className="mt-3 rounded-2xl bg-surface p-3.5 text-sm text-text-3">
          <strong className="mb-1 block text-ink">{t("whatWillHappen")}</strong>
          {effect}
        </div>
        {reasonLabel ? (
          <div className="mt-4 flex flex-col gap-1.5">
            <label htmlFor="confirm-reason" className="text-sm font-semibold">
              {reasonLabel}
            </label>
            <textarea
              id="confirm-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full resize-y rounded-[14px] border border-line-strong bg-white px-3.5 py-3 text-base"
            />
            {minReason > 0 ? (
              <span className={reasonOk ? "text-[13px] text-ok" : "text-[13px] text-text-2"}>
                {t("reasonCount", { count: reason.trim().length, min: minReason })}
              </span>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <div className="mt-3">
            <FormMessage tone="error">{error}</FormMessage>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => reset(false)}>
            {t("cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={pending}
            disabled={pending || !reasonOk}
            onClick={() =>
              start(async () => {
                setError("");
                const r = await onConfirm(reason.trim());
                if (r.error) {
                  setError(r.error);
                  return;
                }
                reset(false);
                onDone?.();
              })
            }
          >
            {pending ? t("working") : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
