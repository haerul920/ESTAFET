"use client";

import { useActionState, useState } from "react";
import { motion } from "framer-motion";
import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BotFields, useFillTimer } from "@/components/ui/BotFields";
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

/**
 * Report a project: a dialog with each reason and its rule in one line, required details, an optional evidence link,
 * a bot check for guests, and a confirmation with a reference code. It brings its own button.
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

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          {/* Motion lifts the button and waves the flag, CSS turns it red. No whileTap on a Radix trigger. */}
          <motion.button
            type="button"
            initial="rest"
            animate="rest"
            whileHover="hover"
            variants={{ rest: { y: 0 }, hover: { y: -2 } }}
            className="group inline-flex h-11 flex-none cursor-pointer items-center gap-2 self-center rounded-full border-[1.5px] border-line-strong bg-white px-4 text-sm font-semibold leading-none text-ink transition-colors duration-200 hover:border-danger hover:bg-[#fdecea] hover:text-danger focus-visible:border-danger focus-visible:text-danger active:bg-[#fbdcd9]"
          >
            <motion.span
              aria-hidden="true"
              className="inline-flex origin-bottom-left"
              variants={{ rest: { rotate: 0 }, hover: { rotate: [0, -16, 12, -6, 0], transition: { duration: 0.55 } } }}
            >
              <Flag size={16} />
            </motion.span>
            {t("open")}
          </motion.button>
        </DialogTrigger>
      )}
      <DialogContent title={t("title")} className="w-[min(560px,calc(100vw-2rem))]">
        {/* The form only exists while the dialog is open, so its state (and its timer) start fresh every time. */}
        <ReportForm projectId={projectId} signedIn={signedIn} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ReportForm({ projectId, signedIn, onClose }: { projectId: string; signedIn: boolean; onClose: () => void }) {
  const t = useTranslations("report");
  const [reason, setReason] = useState("");
  // The form only exists while the dialog is open, so the timer starts when it appears.
  const stamp = useFillTimer();
  const [state, dispatch, pending] = useActionState<FormState, FormData>(submitReport, {});
  const action = (formData: FormData) => {
    dispatch(stamp(formData));
  };
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};

  if (state.ok) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        <FormMessage tone="success">{state.message}</FormMessage>
        {signedIn ? (
          <Link href="/laporan-saya" className="link-anim self-start font-semibold text-blue">
            {t("myReports")}
          </Link>
        ) : (
          <p className="m-0 text-sm text-text-2">{t("keepReference")}</p>
        )}
        <Button variant="outline" onClick={onClose} className="self-start">
          {t("close")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <p className="mb-0 mt-3 text-sm text-text-2">{t("intro")}</p>
      <form action={action} noValidate className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="project_id" value={projectId} />
        {signedIn ? null : <BotFields />}
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
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? t("sending") : t("send")}
          </Button>
        </div>
      </form>
    </>
  );
}
