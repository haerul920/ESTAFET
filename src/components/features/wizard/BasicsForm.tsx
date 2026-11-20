"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { FACULTIES, KIND_LABEL, STOP_REASON_LABEL } from "@/lib/labels";
import { saveBasics } from "@/app/actions/projects";
import type { FormState } from "@/lib/validation";
import type { Project } from "@/lib/db/types";

export function BasicsForm({ project }: { project: Project | null }) {
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

  return (
    <form action={action} noValidate onChange={() => setDirty(true)} className="flex max-w-[760px] flex-col gap-5">
      {project ? <input type="hidden" name="id" value={project.id} /> : null}
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <TextField label="Project title" name="title" defaultValue={v("title", project?.title)} error={fe.title} required maxLength={120} />
      <TextArea
        label="Short summary"
        name="summary"
        rows={4}
        defaultValue={v("summary", project?.summary)}
        error={fe.summary}
        hint="What it is and who it helps. This appears on the public teaser, so keep private details out."
        required
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
        <SelectField label="Type of work" name="kind" defaultValue={v("kind", project?.kind ?? "")} error={fe.kind} required>
          <option value="" disabled>
            Choose one
          </option>
          {Object.entries(KIND_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </SelectField>
        <SelectField label="Faculty or field" name="field" defaultValue={v("field", project?.field ?? "")} error={fe.field} required>
          <option value="" disabled>
            Choose one
          </option>
          {FACULTIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Year"
          name="year"
          type="number"
          inputMode="numeric"
          defaultValue={v("year", project?.year ?? new Date().getFullYear())}
          error={fe.year}
          required
        />
      </div>
      <SelectField label="Why did it stop?" name="stop_reason" defaultValue={v("stop_reason", project?.stop_reason ?? "")} error={fe.stop_reason} required>
        <option value="" disabled>
          Choose one
        </option>
        {Object.entries(STOP_REASON_LABEL).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </SelectField>
      <TextArea
        label="Where it stopped (optional)"
        name="stopped_note"
        rows={2}
        defaultValue={v("stopped_note", project?.stopped_note)}
        error={fe.stopped_note}
        hint="One or two sentences, for example what the last review said."
      />
      <fieldset className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4 rounded-[28px] border-0 bg-surface p-6">
        <legend className="px-2 text-lg font-semibold">Your advisor</legend>
        <TextField label="Advisor name" name="advisor_name" defaultValue={v("advisor_name", project?.advisor_name)} error={fe.advisor_name} required />
        <TextField
          label="Advisor email"
          name="advisor_email"
          type="email"
          defaultValue={v("advisor_email", project?.advisor_email)}
          error={fe.advisor_email}
          hint="Used only to label the private approval link. ESTAFET does not send email."
          required
        />
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" arrow size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save and continue"}
        </Button>
      </div>
    </form>
  );
}
