"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { CheckboxField, FormMessage, SelectField } from "@/components/ui/Field";
import { saveEmailPreferences } from "@/app/actions/account";

interface State {
  error?: string;
  ok?: boolean;
}

/** Turn notification emails on or off and pick their language. Safety emails are sent either way (the text says so). */
export function EmailPreferences({ enabled, locale }: { enabled: boolean; locale: "id" | "en" }) {
  const t = useTranslations("account.email");
  const [state, action, pending] = useActionState<State, FormData>(async (_prev, formData) => {
    const r = await saveEmailPreferences(formData);
    return r.error ? { error: r.error } : { ok: true };
  }, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <CheckboxField label={t("toggle")} name="enabled" defaultChecked={enabled} />
      <SelectField
        label={t("language")}
        name="locale"
        defaultValue={locale}
        className="max-w-[260px]"
        options={[
          { value: "id", label: t("langId") },
          { value: "en", label: t("langEn") },
        ]}
      />
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{t("saved")}</FormMessage> : null}
      <div>
        <Button type="submit" variant="outlineBlue" disabled={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
