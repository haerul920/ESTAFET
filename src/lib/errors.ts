import en from "../../messages/en.json";
import type { TFn } from "@/lib/labels";

/** The shape of a Supabase or PostgREST error. SQL functions put a short code in `hint`. */
export interface DbError {
  message?: string;
  hint?: string | null;
  code?: string;
}

/**
 * A message in the user's language for an error from a database function.
 * `t` is the translator for the `errors` namespace. Unknown errors get a generic message, never raw English or SQL text.
 */
export function dbErrorMessage(t: TFn, error: DbError | null | undefined): string {
  const hint = error?.hint ?? "";
  if (hint && KNOWN_HINTS.has(hint)) return t(`hints.${hint}`);
  if (error?.code === "42501") return t("forbidden");
  return t("generic");
}

/** Every hint that has a message. Derived from the message file, so a new message is picked up without a second list. */
export const KNOWN_HINTS: ReadonlySet<string> = new Set(Object.keys(en.errors.hints));
