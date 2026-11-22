"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ReasonAction } from "./ReasonDialog";
import { StatusPill } from "./ui";
import { updateSetting } from "@/app/[locale]/admin/actions";

const SOURCE = {
  setting: ["sourceSetting", "info"],
  env: ["sourceEnv", "neutral"],
  default: ["sourceDefault", "neutral"],
} as const;

export function SettingRow({
  settingKey,
  label,
  help,
  kind,
  value,
  source,
  fallback,
  unit,
}: {
  settingKey: string;
  label: string;
  help: string;
  kind: "number" | "text" | "list" | "boolean" | "email";
  value: string | boolean;
  source: "setting" | "env" | "default";
  fallback: string;
  unit?: string;
}) {
  const t = useTranslations("admin.settings.row");
  const [draft, setDraft] = useState<string | boolean>(value);
  const changed = draft !== value;
  const [sourceKey, tone] = SOURCE[source];
  const id = `set-${settingKey}`;

  return (
    <div
      data-setting={settingKey}
      className="grid items-start gap-3 border-b border-line py-4 last:border-b-0 md:grid-cols-[1fr_280px_auto]"
    >
      <div>
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        <p className="mb-0 mt-0.5 text-[13px] text-text-2">{help}</p>
        <p className="mb-0 mt-1 flex flex-wrap items-center gap-2 text-[13px]">
          <StatusPill tone={tone}>{t(sourceKey)}</StatusPill>
          <span className="text-text-2">{t("withoutOverride", { value: fallback })}</span>
        </p>
      </div>
      <div>
        {kind === "boolean" ? (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
            <input
              id={id}
              type="checkbox"
              checked={draft === true}
              onChange={(e) => setDraft(e.target.checked)}
              className="h-5 w-5 accent-[#1760d6]"
            />
            {draft === true ? t("on") : t("off")}
          </label>
        ) : kind === "list" ? (
          <textarea
            id={id}
            rows={2}
            value={String(draft)}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("domainsExample")}
            className="w-full rounded-[14px] border border-line-strong bg-white px-3.5 py-2.5 font-code text-[13px]"
          />
        ) : (
          <div className="flex items-center gap-2">
            <input
              id={id}
              type={kind === "number" ? "number" : kind === "email" ? "email" : "text"}
              value={String(draft)}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[44px] w-full rounded-[14px] border border-line-strong bg-white px-3.5"
            />
            {unit ? <span className="text-sm text-text-2">{unit}</span> : null}
          </div>
        )}
      </div>
      <ReasonAction
        small
        label={t("save")}
        tone="primary"
        disabled={!changed}
        consequence={t.rich("effect", {
          label,
          from: String(value) || t("empty"),
          to: String(draft) || t("empty"),
          strong: (chunks) => <strong>{chunks}</strong>,
          code: (chunks) => <code className="font-code">{chunks}</code>,
        })}
        action={(reason) => updateSetting(settingKey, draft, reason)}
        successMessage={t("saved", { label })}
      />
    </div>
  );
}
