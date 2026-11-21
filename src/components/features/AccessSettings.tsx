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

const MODES: AccessMode[] = ["open", "by_request", "paused"];
const KEY = { open: "open", by_request: "byRequest", paused: "paused" } as const;

/**
 * Access mode and team limit. Used on the "Team and access" step and in the project settings.
 * Shows in plain words what will change before the owner saves. The database logs the change in the project lineage.
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
  const label = (m: AccessMode) => t(KEY[m]);
  const limitLabel = (n: number | null) => (n === null ? t("maxNone") : n === 1 ? t("max1") : t("max3"));

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
    <Card as="section" aria-labelledby="access-h" className="flex flex-col gap-5">
      <h2 id="access-h" className="m-0 text-xl">
        {t("title")}
      </h2>

      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-2 p-0 text-sm font-semibold">{t("mode")}</legend>
        {MODES.map((m) => (
          <label
            key={m}
            className={cn(
              "flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[18px] border-[1.5px] bg-white p-4 transition-colors",
              mode === m ? "border-blue bg-blue-tint" : "border-line hover:bg-surface",
            )}
          >
            <input
              type="radio"
              name={`access-mode-${projectId}`}
              value={m}
              checked={mode === m}
              onChange={() => {
                setMode(m);
                setMessage(null);
              }}
              className="mt-1 h-5 w-5 flex-none accent-[var(--blue)]"
            />
            <span>
              <strong className="block">{label(m)}</strong>
              <span className="text-sm text-text-2">{t(`${KEY[m]}Text`)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="max-w-[360px]">
        <SelectField
          label={t("max")}
          value={max}
          onChange={(e) => {
            setMax(e.target.value);
            setMessage(null);
          }}
          hint={t("maxHint")}
        >
          <option value="1">{t("max1")}</option>
          <option value="3">{t("max3")}</option>
          <option value="none">{t("maxNone")}</option>
        </SelectField>
      </div>

      <div className="rounded-[18px] bg-surface p-4 text-sm text-text-3" aria-live="polite">
        <strong className="mb-1 block text-ink">{t("effectTitle")}</strong>
        {changed ? (
          <ul className="m-0 list-disc pl-5">
            {mode !== initialMode ? <li>{t("fromTo", { from: label(initialMode), to: label(mode) })}</li> : null}
            {maxValue !== initialMax ? (
              <li>{t("limitChange", { from: limitLabel(initialMax), to: limitLabel(maxValue) })}</li>
            ) : null}
          </ul>
        ) : (
          t("noChange")
        )}
        {watchers > 0 ? <p className="mb-0 mt-2">{t("watchersNote")}</p> : null}
      </div>

      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <div>
        <Button onClick={save} disabled={!changed || pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </Card>
  );
}
