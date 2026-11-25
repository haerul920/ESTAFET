"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormMessage, SelectField } from "@/components/ui/Field";
import { saveAccessSettings } from "@/app/actions/owner";
import { cn } from "@/lib/cn";
import type { AccessMode } from "@/lib/db/types";

const MODES: AccessMode[] = ["open", "by_request"];
const KEY = { open: "open", by_request: "byRequest" } as const;

export interface AccessValue {
  mode: AccessMode;
  max: number | null;
}

/** The two choices: who can open the files, and how many teams at once. The parent keeps and saves the value. */
export function AccessFields({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: AccessValue;
  onChange: (next: AccessValue) => void;
}) {
  const t = useTranslations("access");
  return (
    <>
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-2 p-0 text-sm font-semibold">{t("mode")}</legend>
        {MODES.map((m) => (
          <label
            key={m}
            className={cn(
              "flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[18px] border-[1.5px] bg-white p-4 transition-colors",
              value.mode === m ? "border-blue bg-blue-tint" : "border-line hover:bg-surface",
            )}
          >
            <input
              type="radio"
              name={`access-mode-${projectId}`}
              value={m}
              checked={value.mode === m}
              onChange={() => onChange({ ...value, mode: m })}
              className="mt-1 h-5 w-5 flex-none accent-[var(--blue)]"
            />
            <span>
              <strong className="block">{t(KEY[m])}</strong>
              <span className="text-sm text-text-2">{t(`${KEY[m]}Text`)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="max-w-[360px]">
        <SelectField
          label={t("max")}
          value={value.max === null ? "none" : String(value.max)}
          onValueChange={(next) => onChange({ ...value, max: next === "none" ? null : Number(next) })}
          hint={t("maxHint")}
          options={[
            { value: "1", label: t("max1") },
            { value: "3", label: t("max3") },
            { value: "none", label: t("maxNone") },
          ]}
        />
      </div>
    </>
  );
}

/**
 * Access mode and team limit in the project settings, with its own save button. The database logs a change in the
 * project lineage. (The share wizard uses AccessFields and saves them with its "Save and continue" button.)
 */
export function AccessSettings({
  projectId,
  mode: initialMode,
  max: initialMax,
  watchers = 0,
}: {
  projectId: string;
  mode: AccessMode;
  max: number | null;
  /** How many people chose "Notify me" (only shown to owners). */
  watchers?: number;
}) {
  const t = useTranslations("access");
  const router = useRouter();
  const [mode, setMode] = useState<AccessMode>(initialMode);
  const [max, setMax] = useState<string>(initialMax === null ? "none" : String(initialMax));
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const maxValue = max === "none" ? null : Number(max);
  const changed = mode !== initialMode || maxValue !== initialMax;

  function save() {
    start(async () => {
      setMessage(null);
      const r = await saveAccessSettings(projectId, mode, maxValue);
      if (r.error) {
        setMessage({ tone: "error", text: r.error });
        return;
      }
      setMessage({ tone: "success", text: t("saved") });
      router.refresh();
    });
  }

  return (
    <Card as="section" aria-labelledby="access-h" className="flex flex-col gap-5" data-unsaved={changed || undefined}>
      <h2 id="access-h" className="m-0 text-xl">
        {t("title")}
      </h2>

      <AccessFields
        projectId={projectId}
        value={{ mode, max: maxValue }}
        onChange={(next) => {
          setMode(next.mode);
          setMax(next.max === null ? "none" : String(next.max));
          setMessage(null);
        }}
      />

      {watchers > 0 ? <p className="m-0 text-sm text-text-3">{t("watchersNote")}</p> : null}

      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <div>
        <Button onClick={save} loading={pending} disabled={!changed || pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </Card>
  );
}
