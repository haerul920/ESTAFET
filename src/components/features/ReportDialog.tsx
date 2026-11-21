"use client";

import { useActionState, useState } from "react";
import Script from "next/script";
import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { FormMessage, TextArea, TextField } from "@/components/ui/Field";
import { submitReport } from "@/app/actions/reports";
import type { FormState } from "@/lib/validation";
import { cn } from "@/lib/cn";

const REASONS = [
  "copyright",
  "personal_data",
  "false_information",
  "inappropriate",
  "false_ownership",
  "harmful_file",
  "spam",
  "other",
] as const;

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Report a project: a dialog with each reason and its rule in one line, required details, an optional evidence link,
 * a bot check for guests, and a confirmation with a reference code. Open it from a button, or control it from a menu.
 */
export function ReportDialog({
  projectId,
  signedIn,
  open,
  onOpenChange,
  hideTrigger,
}: {
  projectId: string;
  signedIn: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const t = useTranslations("report");
  const [inner, setInner] = useState(false);
  const isOpen = open ?? inner;
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setInner(next);
  };
  const [reason, setReason] = useState("");
  // When the dialog opened: the server rejects forms that were submitted impossibly fast (a simple bot signal).
  const [startedAt, setStartedAt] = useState(0);
  const [state, action, pending] = useActionState<FormState, FormData>(submitReport, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (next) setStartedAt(Date.now());
        setOpen(next);
      }}
    >
      {hideTrigger ? null : (
        <div className="rounded-[28px] border border-line-soft p-4">
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex min-h-[44px] w-full cursor-pointer items-center gap-2 text-left text-sm font-semibold text-text-2 hover:text-ink"
            >
              <Flag size={16} aria-hidden="true" /> {t("open")}
            </button>
          </DialogTrigger>
        </div>
      )}
      <DialogContent
        title={t("title")}
        description={state.ok ? undefined : t("intro")}
        className="w-[min(560px,calc(100vw-2rem))]"
      >
        {state.ok ? (
          <div className="mt-4 flex flex-col gap-3">
            <FormMessage tone="success">{state.message}</FormMessage>
            {signedIn ? (
              <Link href="/laporan-saya" className="link-anim self-start font-semibold text-blue">
                {t("myReports")}
              </Link>
            ) : (
              <p className="m-0 text-sm text-text-2">{t("keepReference")}</p>
            )}
            <Button variant="outline" onClick={() => setOpen(false)} className="self-start">
              {t("close")}
            </Button>
          </div>
        ) : (
          <form action={action} noValidate className="mt-4 flex flex-col gap-4">
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="started_at" value={startedAt} />
            {/* Honeypot: people never see or fill this. */}
            <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
              </label>
            </div>
            {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1 p-0 text-sm font-semibold">{t("reasonLegend")}</legend>
              {REASONS.map((r) => (
                <label
                  key={r}
                  className={cn(
                    "flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[14px] border-[1.5px] px-3.5 py-2.5",
                    (reason || v.reason) === r ? "border-blue bg-blue-tint" : "border-line bg-white hover:bg-surface",
                  )}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={(reason || v.reason) === r}
                    onChange={() => setReason(r)}
                    className="mt-1 h-5 w-5 flex-none accent-[var(--blue)]"
                  />
                  <span>
                    <strong className="block text-[15px]">{t(`r.${r}`)}</strong>
                    <span className="text-[13px] text-text-2">{t(`d.${r}`)}</span>
                  </span>
                </label>
              ))}
              {fe.reason ? (
                <span role="alert" className="text-[13px] font-semibold text-danger">
                  {fe.reason}
                </span>
              ) : null}
            </fieldset>

            <TextArea
              label={t("details")}
              name="details"
              rows={4}
              defaultValue={v.details}
              error={fe.details}
              maxLength={1000}
            />
            <TextField
              label={t("evidence")}
              name="evidence"
              type="url"
              defaultValue={v.evidence}
              error={fe.evidence}
              hint={t("evidenceHint")}
            />
            {signedIn ? null : (
              <TextField
                label={t("contact")}
                name="contact"
                defaultValue={v.contact}
                error={fe.contact}
                hint={t("contactHint")}
              />
            )}

            {signedIn || !TURNSTILE_SITE_KEY ? null : (
              <>
                <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
                <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} />
              </>
            )}

            <p className="m-0 text-[13px] text-text-2">
              {t.rich("rules", {
                guidelines: (chunks) => (
                  <Link href="/pedoman" className="font-semibold text-blue">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t("sending") : t("send")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
