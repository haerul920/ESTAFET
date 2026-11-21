"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { FormMessage, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { submitReport } from "@/app/actions/reports";

const REPORT_REASON_LIST = ["copyright", "personal_data", "false_information", "inappropriate", "false_ownership", "harmful_file", "spam", "other"] as const;
import type { FormState } from "@/lib/validation";

/** Small, unobtrusive report action for the public teaser page. No account needed. */
export function ReportProject({ projectId }: { projectId: string }) {
  const t = useTranslations("report");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(submitReport, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};

  return (
    <div className="rounded-[28px] border border-line-soft p-4">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-[44px] w-full cursor-pointer items-center gap-2 text-left text-sm font-semibold text-text-2 hover:text-ink">
        <Flag size={16} aria-hidden="true" /> {t("open")}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {state.ok ? (
              <div className="pt-2">
                <FormMessage tone="success">{state.message}</FormMessage>
              </div>
            ) : (
              <form action={action} noValidate className="flex flex-col gap-3 pt-3">
                <input type="hidden" name="project_id" value={projectId} />
                <p className="m-0 text-[13px] text-text-2">
                  {t("intro")}
                </p>
                {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
                <SelectField label={t("reason")} name="reason" value={reason || (v.reason ?? "")} onChange={(e) => setReason(e.target.value)} error={fe.reason}>
                  <option value="" disabled>
                    {t("choose")}
                  </option>
                  {REPORT_REASON_LIST.map((r) => (
                    <option key={r} value={r}>
                      {t(`r.${r}`)}
                    </option>
                  ))}
                </SelectField>
                <p className="m-0 text-[13px] text-text-2" aria-live="polite">
                  {reason ? t(`d.${reason}`) : null}
                </p>
                <TextArea label={t("details")} name="details" rows={3} defaultValue={v.details} error={fe.details} />
                <TextField label={t("evidence")} name="evidence" type="url" defaultValue={v.evidence} error={fe.evidence} hint={t("evidenceHint")} />
                <TextField label={t("contact")} name="contact" defaultValue={v.contact} error={fe.contact} hint={t("contactHint")} />
                <Button type="submit" size="md" disabled={pending} className="self-start">
                  {pending ? t("sending") : t("send")}
                </Button>
              </form>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
