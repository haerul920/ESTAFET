"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { BotFields, useFillTimer } from "@/components/ui/BotFields";
import { Button } from "@/components/ui/Button";
import { CheckboxField, FormMessage, SearchableSelect, TextField } from "@/components/ui/Field";
import { FACULTIES } from "@/lib/labels";
import { useLabels } from "@/lib/use-labels";
import type { FormState } from "@/lib/validation";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

// Demo account is a plain account that both shares projects and continues other people's projects.
const DEMO = [{ key: "demoA", email: "creator@estafet.demo" }] as const;

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
          <SearchableSelect
            label={t("faculty")}
            name="faculty"
            defaultValue={v.faculty ?? ""}
            hint={t("facultyHint")}
            searchPlaceholder={t("facultySearchPlaceholder")}
            clearLabel={t("facultySearchClear")}
            emptyText={t("facultyEmpty")}
            options={[
              { value: "", label: t("facultyNone") },
              ...FACULTIES.map((f) => ({ value: f, label: L.faculty(f) })),
            ]}
          />
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
        showPasswordLabel={t("showPassword")}
        hidePasswordLabel={t("hidePassword")}
        required
      />
      {!login ? (
        <TextField
          label={t("confirmPassword")}
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          error={fe.confirm_password}
          showPasswordLabel={t("showPassword")}
          hidePasswordLabel={t("hidePassword")}
          required
        />
      ) : null}
      {!login ? (
        <CheckboxField
          name="accept_policies"
          defaultChecked={v.accept_policies === "on"}
          error={fe.accept_policies}
          label={t.rich("accept", {
            terms: (chunks) => (
              <Link
                href="/terms"
                className="link-anim inline-flex items-center rounded-md px-1.5 py-0.5 font-semibold text-blue underline decoration-blue/35 decoration-1 underline-offset-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-tint hover:text-blue-dark hover:decoration-blue-dark"
              >
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link
                href="/privacy"
                className="link-anim inline-flex items-center rounded-md px-1.5 py-0.5 font-semibold text-blue underline decoration-blue/35 decoration-1 underline-offset-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-tint hover:text-blue-dark hover:decoration-blue-dark"
              >
                {chunks}
              </Link>
            ),
          })}
        />
      ) : null}
      <Button type="submit" variant="primary" disabled={pending} className="mt-2 justify-center">
        {pending ? t("wait") : login ? t("signIn") : t("create")}
      </Button>
      <p className="m-0 flex flex-wrap items-center justify-center gap-2 text-center text-[15px] text-text-2">
        {login ? (
          <>
            <span>{t("newHere")}</span>
            <Link
              href={`/signup${nextQuery}`}
              className="group inline-flex items-center gap-1.5 rounded-full border border-blue/20 bg-blue-tint/45 px-3.5 py-1 font-semibold text-blue no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-blue/45 hover:bg-blue-tint hover:text-blue-dark hover:shadow-[0_6px_16px_rgba(23,96,214,0.14)] active:translate-y-0 active:scale-[0.98]"
            >
              <span className="link-anim">{t("signupTitle")}</span>
              <ArrowRight
                size={15}
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
          </>
        ) : (
          <>
            <span>{t("haveAccount")}</span>
            <Link
              href={`/login${nextQuery}`}
              className="group inline-flex items-center gap-1.5 rounded-full border border-blue/20 bg-blue-tint/45 px-3.5 py-1 font-semibold text-blue no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-blue/45 hover:bg-blue-tint hover:text-blue-dark hover:shadow-[0_6px_16px_rgba(23,96,214,0.14)] active:translate-y-0 active:scale-[0.98]"
            >
              <span className="link-anim">{t("signIn")}</span>
              <ArrowRight
                size={15}
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
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
