"use client";

import { useActionState } from "react";
import { motion } from "framer-motion";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxField, FormMessage, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { submitRequest } from "@/app/actions/requests";
import { EFFORT_LABEL, PURPOSE_LABEL } from "@/lib/labels";
import type { FormState } from "@/lib/validation";
import type { TeaserItem } from "@/lib/db/types";

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <motion.fieldset
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      className="m-0 flex flex-col gap-4 rounded-[28px] border border-surface bg-surface p-6"
    >
      <legend className="px-2 text-lg font-semibold">{legend}</legend>
      {children}
    </motion.fieldset>
  );
}

export function RequestForm({
  projectId,
  slug,
  tasks,
}: {
  projectId: string;
  slug: string;
  tasks: TeaserItem[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitRequest, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const chosen = new Set((state.data?.task_ids as string[] | undefined) ?? []);

  return (
    <form action={action} noValidate className="flex min-w-0 flex-[1_1_600px] flex-col gap-6">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="slug" value={slug} />
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <Fieldset legend="1. Your team">
        <TextField label="Team name" name="team_name" placeholder="Name your team" defaultValue={v.team_name} error={fe.team_name} required />
        <TextField
          label="Teammates' university emails"
          name="teammates"
          placeholder="Separate with commas. Teams have 3 to 4 members."
          defaultValue={v.teammates}
          error={fe.teammates}
          hint="You are added automatically."
          required
        />
      </Fieldset>

      <Fieldset legend="2. Which verified tasks will you take on?">
        {tasks.length === 0 ? (
          <p className="m-0 text-text-2">This project has no verified next tasks, so it cannot be requested yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {tasks.map((t) => (
              <label
                key={t.id}
                className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[14px] border border-line-soft bg-white p-3 transition-colors has-[:checked]:border-blue has-[:checked]:bg-blue-tint"
              >
                <input type="checkbox" name="task_ids" value={t.id} defaultChecked={chosen.has(t.id)} className="mt-0.5 h-5 w-5 flex-none accent-[#1760d6]" />
                <span>
                  <strong>{t.title}</strong>
                  <br />
                  <span className="text-sm text-text-2">{t.effort ? EFFORT_LABEL[t.effort] : "Unsized"} effort</span>
                </span>
              </label>
            ))}
          </div>
        )}
        {fe.task_ids ? (
          <span role="alert" className="text-[13px] font-semibold text-danger">
            {fe.task_ids}
          </span>
        ) : null}
      </Fieldset>

      <Fieldset legend="3. Your plan">
        <TextArea
          label="What will you do in your first month?"
          name="plan"
          rows={4}
          placeholder="For example, which task you start with and what you expect to have at the end."
          defaultValue={v.plan}
          error={fe.plan}
          required
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
          <SelectField label="What is this for?" name="purpose" defaultValue={v.purpose ?? ""} error={fe.purpose} required>
            <option value="" disabled>
              Choose one
            </option>
            {Object.entries(PURPOSE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </SelectField>
          <TextField label="Target date" name="target_date" type="date" defaultValue={v.target_date} error={fe.target_date} required />
        </div>
        <TextArea
          label="Why is your team a good fit?"
          name="fit_note"
          rows={3}
          placeholder="Relevant skills, courses or earlier projects."
          defaultValue={v.fit_note}
          error={fe.fit_note}
        />
      </Fieldset>

      <Card tone="warn" className="!rounded-[28px] !p-5">
        <CheckboxField
          name="acknowledge"
          defaultChecked={v.acknowledge === "on"}
          error={fe.acknowledge}
          label="I understand that if this request is approved, my team must credit the original team and advisor in any submission or publication that builds on this project."
        />
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="md" disabled={pending || tasks.length === 0} className="px-7">
          {pending ? "Sending…" : "Send request"}
        </Button>
        <ButtonLink href={`/projects/${slug}`} variant="outline">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
