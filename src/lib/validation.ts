import { z } from "zod";
import type { TFn } from "@/lib/labels";

export interface FormState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  data?: Record<string, unknown>;
}

/** Turns Zod issues into a flat { field: message } map for inline errors. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  }
  return out;
}

/** Only allow same-site relative redirects. */
export function safeNext(next: string | null | undefined, fallback = "/dasbor"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

/** `t` is the translator for the `validation` namespace. */
export const emailSchema = (t: TFn) => z.string().trim().toLowerCase().email(t("email"));
