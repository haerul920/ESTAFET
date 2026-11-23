"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { CheckboxField, FormMessage, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { saveTrial } from "@/app/[locale]/admin/actions";
import { useToast } from "@/components/ui/Toast";

export interface TrialDraft {
  id?: string;
  participant_code: string;
  cohort: "baseline" | "estafet";
  project_id: string;
  started_at: string;
  minutes_to_understand: string;
  completed: boolean;
  correct_answers: string;
  total_questions: string;
  sus_score: string;
  notes: string;
  consent_confirmed: boolean;
  is_demo: boolean;
}

export const EMPTY_TRIAL: TrialDraft = {
  participant_code: "",
  cohort: "estafet",
  project_id: "",
  started_at: "",
  minutes_to_understand: "",
  completed: true,
  correct_answers: "",
  total_questions: "5",
  sus_score: "",
  notes: "",
  consent_confirmed: false,
  is_demo: false,
};

/** Record or edit one trial session. Pseudonym codes only. Saved and audited through admin_trial_save. */
export function TrialForm({
  initial,
  projects,
  onClose,
}: {
  initial: TrialDraft;
  projects: { id: string; title: string }[];
  onClose: () => void;
}) {
  const t = useTranslations("admin.trials.form");
  const [v, setV] = useState<TrialDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const set = <K extends keyof TrialDraft>(k: K, val: TrialDraft[K]) => setV((cur) => ({ ...cur, [k]: val }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveTrial({ ...v, started_at: v.started_at ? new Date(v.started_at).toISOString() : "" });
      if (res.error) {
        setErrors((res as { fieldErrors?: Record<string, string> }).fieldErrors ?? {});
        setMessage(res.error);
        return;
      }
      toast.push({ message: v.id ? t("updated") : t("recorded") });
      router.refresh();
      onClose();
    });
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-3 rounded-3xl border-2 border-blue bg-white p-5"
      aria-label={v.id ? t("editTitle") : t("recordTitle")}
    >
      <h2 className="m-0 text-lg">{v.id ? t("editTitle") : t("recordTitle")}</h2>
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={t("code")}
          value={v.participant_code}
          onChange={(e) => set("participant_code", e.target.value)}
          error={errors.participant_code}
          hint={t("codeHint")}
          maxLength={12}
        />
        <SelectField
          label={t("cohort")}
          value={v.cohort}
          onChange={(e) => set("cohort", e.target.value as TrialDraft["cohort"])}
          error={errors.cohort}
        >
          <option value="baseline">{t("baselineOption")}</option>
          <option value="estafet">{t("estafetOption")}</option>
        </SelectField>
        <SelectField label={t("project")} value={v.project_id} onChange={(e) => set("project_id", e.target.value)}>
          <option value="">{t("notLinked")}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t("start")}
          type="datetime-local"
          value={v.started_at}
          onChange={(e) => set("started_at", e.target.value)}
          error={errors.started_at}
        />
        <TextField
          label={t("minutes")}
          type="number"
          step="0.5"
          min="0"
          value={v.minutes_to_understand}
          onChange={(e) => set("minutes_to_understand", e.target.value)}
          error={errors.minutes_to_understand}
        />
        <TextField
          label={t("sus")}
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={v.sus_score}
          onChange={(e) => set("sus_score", e.target.value)}
          error={errors.sus_score}
        />
        <TextField
          label={t("correct")}
          type="number"
          min="0"
          value={v.correct_answers}
          onChange={(e) => set("correct_answers", e.target.value)}
          error={errors.correct_answers}
        />
        <TextField
          label={t("asked")}
          type="number"
          min="1"
          value={v.total_questions}
          onChange={(e) => set("total_questions", e.target.value)}
          error={errors.total_questions}
        />
      </div>
      <CheckboxField label={t("finished")} checked={v.completed} onChange={(e) => set("completed", e.target.checked)} />
      <TextArea
        label={t("notes")}
        rows={2}
        value={v.notes}
        onChange={(e) => set("notes", e.target.value)}
        hint={t("notesHint")}
      />
      <CheckboxField
        label={t("consent")}
        checked={v.consent_confirmed}
        onChange={(e) => set("consent_confirmed", e.target.checked)}
        error={errors.consent_confirmed}
      />
      <CheckboxField label={t("demo")} checked={v.is_demo} onChange={(e) => set("is_demo", e.target.checked)} />
      <div className="flex gap-2">
        <Button type="submit" size="md" pending={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
        <Button type="button" size="md" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
