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

export const KNOWN_HINTS = new Set([
  "sign_in", "email_unverified", "not_owner", "not_editable", "no_account", "already_member", "no_invitation", "owner_protected",
  "team_consent", "items_pending", "no_kept_item", "policies_required", "already_published",
  "archived", "moderated", "not_published", "not_archivable", "bad_limit", "not_available", "own_project", "paused", "needs_request",
  "open_mode", "agreement_version", "already_has_access", "access_revoked", "quota_full", "open_request", "reapply_cooldown",
  "no_task", "already_decided", "expired", "not_approved", "not_in_request", "already_revoked", "reason_short",
]);
