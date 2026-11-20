"use client";

import { useActionState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { FormMessage, SelectField, TextField } from "@/components/ui/Field";
import { FACULTIES } from "@/lib/labels";
import type { FormState } from "@/lib/validation";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

const DEMO = [
  { label: "Creator", email: "creator@estafet.demo" },
  { label: "Adopter", email: "adopter@estafet.demo" },
];

export function AuthForm({ mode, action, next }: { mode: "login" | "signup"; action: Action; next: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const login = mode === "login";

  return (
    <motion.form
      action={formAction}
      noValidate
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <input type="hidden" name="next" value={next} />
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state.ok && state.message ? <FormMessage tone="success">{state.message}</FormMessage> : null}

      {!login ? (
        <>
          <TextField label="Full name" name="full_name" autoComplete="name" defaultValue={v.full_name} error={fe.full_name} required />
          <SelectField label="Faculty" name="faculty" defaultValue={v.faculty ?? ""} hint="Optional. Helps adopters see your background.">
            <option value="">Prefer not to say</option>
            {FACULTIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </SelectField>
        </>
      ) : null}
      <TextField
        label="University email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={v.email}
        error={fe.email}
        required
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete={login ? "current-password" : "new-password"}
        hint={login ? undefined : "At least 8 characters."}
        error={fe.password}
        required
      />
      <Button type="submit" variant="primary" disabled={pending} className="mt-2 justify-center">
        {pending ? "Please wait…" : login ? "Sign in" : "Create account"}
      </Button>
      <p className="m-0 text-center text-[15px] text-text-2">
        {login ? (
          <>
            New to ESTAFET? <Link href={`/signup${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</Link>
          </>
        ) : (
          <>
            Already have an account? <Link href={`/login${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</Link>
          </>
        )}
      </p>
      {login ? (
        <div className="rounded-[18px] bg-warn-bg p-4 text-sm text-warn-ink">
          <strong>Demo accounts (simulated data).</strong> Password for all:{" "}
          <code className="font-code">Demo-Pass-2026!</code>
          <ul className="m-0 mt-2 list-none p-0">
            {DEMO.map((d) => (
              <li key={d.email}>
                {d.label}: <code className="font-code">{d.email}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </motion.form>
  );
}
