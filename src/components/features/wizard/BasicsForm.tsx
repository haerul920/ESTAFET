"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { FormMessage, SearchableSelect, TextArea, TextField } from "@/components/ui/Field";
import { FACULTIES } from "@/lib/labels";
import { useLabels } from "@/lib/use-labels";
import { saveBasics } from "@/app/actions/projects";
import { autosaveBasics, saveDraftAndExit } from "@/app/actions/owner";
import { useRouter } from "@/i18n/navigation";
import { LeaveDialog } from "./SaveExit";
import type { FormState } from "@/lib/validation";
import type { Project } from "@/lib/db/types";
import { WizardActions } from "./WizardActions";

export function BasicsForm({ project }: { project: Project | null }) {
  const t = useTranslations("basics");
  const tw = useTranslations("wizard");
  const ta = useTranslations("auth");
  const tx = useTranslations("saveExit");
  const router = useRouter();
  const L = useLabels();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [auto, setAuto] = useState<"idle" | "saving" | "saved" | "invalid">("idle");
  const [state, action, pending] = useActionState<FormState, FormData>(saveBasics, {});
  const [dirty, setDirty] = useState(false);
  const fe = state.fieldErrors ?? {};
  const v = (k: string, fallback: string | number | null | undefined) =>
    state.values?.[k] ?? (fallback === undefined || fallback === null ? "" : String(fallback));
  // The chosen kind, so the name field for "Lainnya" can appear as soon as it is picked.
  const [kind, setKind] = useState(() => v("kind", project?.kind ?? ""));

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
      const values = Object.fromEntries(
        [...new FormData(form).entries()].filter(([, val]) => typeof val === "string"),
      ) as Record<string, string>;
      setAuto("saving");
      const r = await autosaveBasics(project.id, values);
      setAuto(r.saved ? "saved" : "invalid");
      if (r.saved) setDirty(false);
    }, 1200);
  }

  // Any edit: the form's own change events, and the pickers, which report their choices themselves.
  function edited() {
    setDirty(true);
    scheduleAutosave();
  }

  // "Save and exit": a new draft created here is remembered, so saving again updates it instead of making another.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [leaving, startLeaving] = useTransition();
  const [exitQuestion, setExitQuestion] = useState<{ title: string; text: string } | null>(null);
  const FIELD_LABELS: Record<string, string> = {
    title: t("title"),
    kind: t("kind"),
    kind_other: t("kindOther"),
    field: t("field"),
    year: t("year"),
    stopped_note: t("stoppedNote"),
  };

  function saveAndExit() {
    const form = formRef.current;
    if (!form) return;
    clearTimeout(timer.current);
    const values = Object.fromEntries(
      [...new FormData(form).entries()].filter(([, val]) => typeof val === "string"),
    ) as Record<string, string>;
    startLeaving(async () => {
      const result = await saveDraftAndExit(project?.id ?? createdId, values);
      if (result.id && !project) setCreatedId(result.id);
      if (result.error) {
        setExitQuestion({ title: tx("failedTitle"), text: result.error });
        return;
      }
      const fields = result.skipped.map((key) => FIELD_LABELS[key] ?? key).join(", ");
      if (!result.id) setExitQuestion({ title: tx("noDraftTitle"), text: tx("noDraftText") });
      else if (result.skipped.length > 0) {
        setDirty(false);
        setExitQuestion({ title: tx("skippedTitle"), text: tx("skippedText", { fields }) });
      } else {
        setDirty(false);
        router.push("/dasbor");
      }
    });
  }

  return (
    <form ref={formRef} action={action} noValidate onChange={edited} className="flex flex-col gap-5">
      {project || createdId ? <input type="hidden" name="id" value={project?.id ?? createdId ?? ""} /> : null}
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <TextField
        label={t("title")}
        name="title"
        defaultValue={v("title", project?.title)}
        error={fe.title}
        required
        maxLength={120}
      />
      <div className="flex flex-col gap-5">
        <SearchableSelect
          label={t("kind")}
          name="kind"
          defaultValue={v("kind", project?.kind ?? "")}
          error={fe.kind}
          placeholder={t("choose")}
          options={Object.entries(L.kind).map(([value, label]) => ({ value, label }))}
          searchPlaceholder={t("searchKind")}
          clearLabel={ta("facultySearchClear")}
          emptyText={t("noKind")}
          onValueChange={(value) => {
            setKind(value);
            edited();
          }}
        />
        {kind === "other" ? (
          <TextField
            label={t("kindOther")}
            name="kind_other"
            defaultValue={v("kind_other", project?.kind_other)}
            error={fe.kind_other}
            hint={t("kindOtherHint")}
            required
            maxLength={60}
          />
        ) : null}
        <SearchableSelect
          label={t("field")}
          name="field"
          defaultValue={v("field", project?.field ?? "")}
          error={fe.field}
          placeholder={t("choose")}
          options={FACULTIES.map((f) => ({ value: f, label: L.faculty(f) }))}
          searchPlaceholder={ta("facultySearchPlaceholder")}
          clearLabel={ta("facultySearchClear")}
          emptyText={ta("facultyEmpty")}
          onValueChange={edited}
        />
        <TextField
          label={t("year")}
          name="year"
          type="number"
          inputMode="numeric"
          min={2015}
          max={new Date().getFullYear()}
          defaultValue={v("year", project?.year ?? new Date().getFullYear())}
          error={fe.year}
          required
        />
      </div>
      <TextArea
        label={t("stoppedNote")}
        name="stopped_note"
        rows={2}
        defaultValue={v("stopped_note", project?.stopped_note)}
        error={fe.stopped_note}
        hint={t("stoppedHint")}
      />
      <WizardActions
        left={
          // Autosave works quietly. It speaks up only when it could not save, so nobody thinks their edit is kept.
          project ? (
            <span role="status" aria-live="polite" className="text-sm font-semibold text-warn">
              {auto === "invalid" ? tw("autoFailed") : ""}
            </span>
          ) : null
        }
      >
        <Button variant="outline" size="lg" loading={leaving} disabled={leaving || pending} onClick={saveAndExit}>
          {tx("button")}
        </Button>
        <Button type="submit" arrow size="lg" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </WizardActions>
      <LeaveDialog
        open={exitQuestion !== null}
        onOpenChange={(open) => {
          if (!open) setExitQuestion(null);
        }}
        title={exitQuestion?.title ?? ""}
        text={exitQuestion?.text ?? ""}
        onLeave={() => {
          setDirty(false);
          setExitQuestion(null);
          router.push("/dasbor");
        }}
      />
    </form>
  );
}
