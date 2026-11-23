"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { BotFields, useFillTimer } from "@/components/ui/BotFields";
import { Button } from "@/components/ui/Button";
import { CheckboxField, FormMessage, SelectField, TextField } from "@/components/ui/Field";
import { FACULTIES } from "@/lib/labels";
import { useLabels } from "@/lib/use-labels";
import type { FormState } from "@/lib/validation";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

// Demo accounts are plain accounts. Each one both shares projects and continues other people's projects.
const DEMO = [
  { key: "demoA", email: "creator@estafet.demo" },
  { key: "demoB", email: "adopter@estafet.demo" },
  { key: "demoC", email: "alumni@estafet.demo" },
] as const;

export function AuthForm({ mode, action, next }: { mode: "login" | "signup"; action: Action; next: string }) {
  const t = useTranslations("auth");
  const L = useLabels();
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const stamp = useFillTimer();
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const login = mode === "login";
  const nextQuery = next !== "/dasbor" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <motion.form
      action={(formData: FormData) => formAction(stamp(formData))}
      noValidate
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <input type="hidden" name="next" value={next} />
      {login ? null : <BotFields />}
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state.ok && state.message ? <FormMessage tone="success">{state.message}</FormMessage> : null}

      {!login ? (
        <>
          <TextField
            label={t("fullName")}
            name="full_name"
            autoComplete="name"
            defaultValue={v.full_name}
            error={fe.full_name}
            required
          />
          <SelectField label={t("faculty")} name="faculty" defaultValue={v.faculty ?? ""} hint={t("facultyHint")}>
            <option value="">{t("facultyNone")}</option>
            {FACULTIES.map((f) => (
              <option key={f} value={f}>
                {L.faculty(f)}
              </option>
            ))}
          </SelectField>
        </>
      ) : null}
      <TextField
        label={t("email")}
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={v.email}
        error={fe.email}
        required
      />
      <TextField
        label={t("password")}
        name="password"
        type="password"
        autoComplete={login ? "current-password" : "new-password"}
        hint={login ? undefined : t("passwordHint")}
        error={fe.password}
        required
      />
      {!login ? (
        <CheckboxField
          name="accept_policies"
          defaultChecked={v.accept_policies === "on"}
          error={fe.accept_policies}
          label={t.rich("accept", {
            terms: (chunks) => <Link href="/terms">{chunks}</Link>,
            privacy: (chunks) => <Link href="/privacy">{chunks}</Link>,
          })}
        />
      ) : null}
      <Button type="submit" variant="primary" pending={pending} className="mt-2 justify-center">
        {pending ? t("wait") : login ? t("signIn") : t("create")}
      </Button>
      <p className="m-0 text-center text-[15px] text-text-2">
        {login ? (
          <>
            {t("newHere")} <Link href={`/signup${nextQuery}`}>{t("signupTitle")}</Link>
          </>
        ) : (
          <>
            {t("haveAccount")} <Link href={`/login${nextQuery}`}>{t("signIn")}</Link>
          </>
        )}
      </p>
      {login ? (
        <div className="rounded-[18px] bg-warn-bg p-4 text-sm text-warn-ink">
          <strong>{t("demoTitle")}</strong> {t("demoPassword")} <code className="font-code">Demo-Pass-2026!</code>
          <ul className="m-0 mt-2 list-none p-0">
            {DEMO.map((d) => (
              <li key={d.email}>
                {t(d.key)}: <code className="font-code">{d.email}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </motion.form>
  );
}
