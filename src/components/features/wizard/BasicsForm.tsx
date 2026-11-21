"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { FormMessage, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { FACULTIES } from "@/lib/labels";
import { useLabels } from "@/lib/use-labels";
import { saveBasics } from "@/app/actions/projects";
import { autosaveBasics } from "@/app/actions/owner";
import type { FormState } from "@/lib/validation";
import type { Project } from "@/lib/db/types";

export function BasicsForm({ project }: { project: Project | null }) {
  const t = useTranslations("basics");
  const tw = useTranslations("wizard");
  const L = useLabels();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [auto, setAuto] = useState<"idle" | "saving" | "saved" | "invalid">("idle");
  const [state, action, pending] = useActionState<FormState, FormData>(saveBasics, {});
  const [dirty, setDirty] = useState(false);
  const fe = state.fieldErrors ?? {};
  const v = (k: string, fallback: string | number | undefined) => state.values?.[k] ?? (fallback === undefined ? "" : String(fallback));

  // Warn before leaving with unsaved changes (the wizard saves a draft at the end of each step).
  useEffect(() => {
    if (!dirty || pending) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, pending]);

  useEffect(() => () => clearTimeout(timer.current), []);

  /** Autosave: once the draft exists, valid edits are saved a moment after the last keystroke. */
  function scheduleAutosave() {
    if (!project) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const form = formRef.current;
      if (!form) return;
      const values = Object.fromEntries([...new FormData(form).entries()].filter(([, val]) => typeof val === "string")) as Record<string, string>;
      setAuto("saving");
      const r = await autosaveBasics(project.id, values);
      setAuto(r.saved ? "saved" : "invalid");
      if (r.saved) setDirty(false);
    }, 1200);
  }

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      onChange={() => {
        setDirty(true);
        scheduleAutosave();
      }}
      className="flex max-w-[760px] flex-col gap-5"
    >
      {project ? <input type="hidden" name="id" value={project.id} /> : null}
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <TextField label={t("title")} name="title" defaultValue={v("title", project?.title)} error={fe.title} required maxLength={120} />
      <TextArea
        label={t("summary")}
        name="summary"
        rows={4}
        defaultValue={v("summary", project?.summary)}
        error={fe.summary}
        hint={t("summaryHint")}
        required
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
        <SelectField label={t("kind")} name="kind" defaultValue={v("kind", project?.kind ?? "")} error={fe.kind} required>
          <option value="" disabled>
            {t("choose")}
          </option>
          {Object.entries(L.kind).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("field")} name="field" defaultValue={v("field", project?.field ?? "")} error={fe.field} required>
          <option value="" disabled>
            {t("choose")}
          </option>
          {FACULTIES.map((f) => (
            <option key={f} value={f}>
              {L.faculty(f)}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t("year")}
          name="year"
          type="number"
          inputMode="numeric"
          defaultValue={v("year", project?.year ?? new Date().getFullYear())}
          error={fe.year}
          required
        />
      </div>
      <SelectField label={t("stop")} name="stop_reason" defaultValue={v("stop_reason", project?.stop_reason ?? "")} error={fe.stop_reason} required>
        <option value="" disabled>
          {t("choose")}
        </option>
        {Object.entries(L.stopReason).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </SelectField>
      <TextArea
        label={t("stoppedNote")}
        name="stopped_note"
        rows={2}
        defaultValue={v("stopped_note", project?.stopped_note)}
        error={fe.stopped_note}
        hint={t("stoppedHint")}
      />
      <fieldset className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4 rounded-[28px] border-0 bg-surface p-6">
        <legend className="px-2 text-lg font-semibold">{t("advisorLegend")}</legend>
        <TextField label={t("advisorName")} name="advisor_name" defaultValue={v("advisor_name", project?.advisor_name)} error={fe.advisor_name} />
        <TextField
          label={t("advisorEmail")}
          name="advisor_email"
          type="email"
          defaultValue={v("advisor_email", project?.advisor_email)}
          error={fe.advisor_email}
          hint={t("advisorHint")}
        />
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" arrow size="lg" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
        {project ? (
          <span role="status" aria-live="polite" className={auto === "invalid" ? "text-sm font-semibold text-warn" : "text-sm text-text-2"}>
            {auto === "saving" ? tw("savingAuto") : auto === "saved" ? tw("savedAuto") : auto === "invalid" ? tw("autoFailed") : ""}
          </span>
        ) : null}
      </div>
    </form>
  );
}
