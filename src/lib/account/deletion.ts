import { randomBytes } from "node:crypto";

/**
 * Finishes an account deletion after the 30 day grace period (CLAUDE.md 14.10).
 *
 * The database function `anonymize_deleted_account` does the data part in one transaction (profile becomes "Pengguna lama",
 * access and pending requests end, notifications go, reports lose their link). This module does what SQL cannot:
 * remove the files of draft projects only this person owned, and scrub the sign-in record in Supabase Auth.
 * The profile ROW stays, because published projects and agreements still point to it.
 *
 * It takes a narrow client interface so it can run from a script or a test without importing server-only modules.
 */
export interface DeletionClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
    delete(): { eq(column: string, value: string): PromiseLike<{ error: { message: string } | null }> };
  };
  storage: {
    from(bucket: string): { remove(paths: string[]): PromiseLike<{ error: { message: string } | null }> };
  };
  auth: {
    admin: {
      updateUserById(
        id: string,
        attributes: Record<string, unknown>,
      ): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

export interface DeletionResult {
  profileId: string;
  ok: boolean;
  draftsDeleted: number;
  filesRemoved: number;
  error?: string;
}

/** The address that replaces the real one. `.invalid` can never be a real mailbox (RFC 2606). */
export function scrubbedEmail(profileId: string): string {
  return `deleted-${profileId}@deleted.invalid`;
}

export async function processAccountDeletion(db: DeletionClient, profileId: string): Promise<DeletionResult> {
  const result: DeletionResult = { profileId, ok: false, draftsDeleted: 0, filesRemoved: 0 };

  const anon = await db.rpc("anonymize_deleted_account", { p_profile: profileId });
  if (anon.error) return { ...result, error: anon.error.message };
  const drafts = ((anon.data as { draft_projects?: string[] } | null)?.draft_projects ?? []).filter(Boolean);

  // From here on the database step is done. A failure below is reported with the profile id so it can be finished by hand.
  try {
    for (const projectId of drafts) {
      const files = await db
        .from("project_files")
        .select("storage_path, extracted_text_path")
        .eq("project_id", projectId);
      if (files.error) throw new Error(files.error.message);
      const rows = (files.data ?? []) as { storage_path: string | null; extracted_text_path: string | null }[];
      const originals = rows.map((r) => r.storage_path).filter((p): p is string => Boolean(p));
      const texts = rows.map((r) => r.extracted_text_path).filter((p): p is string => Boolean(p));
      if (originals.length) {
        const r = await db.storage.from("project-files").remove(originals);
        if (r.error) throw new Error(r.error.message);
      }
      if (texts.length) {
        const r = await db.storage.from("extracted-text").remove(texts);
        if (r.error) throw new Error(r.error.message);
      }
      result.filesRemoved += originals.length + texts.length;
      // Rows that belong to the project (files, items, runs, members) go with it through ON DELETE CASCADE.
      const del = await db.from("projects").delete().eq("id", projectId);
      if (del.error) throw new Error(del.error.message);
      result.draftsDeleted += 1;
    }

    const scrub = await db.auth.admin.updateUserById(profileId, {
      email: scrubbedEmail(profileId),
      email_confirm: true,
      password: randomBytes(32).toString("hex"),
      user_metadata: {},
      ban_duration: "876000h",
    });
    if (scrub.error) throw new Error(scrub.error.message);
  } catch (e) {
    return { ...result, error: e instanceof Error ? e.message : String(e) };
  }
  return { ...result, ok: true };
}

/** Runs every deletion that is due. Returns one result per account. */
export async function processDueDeletions(db: DeletionClient): Promise<DeletionResult[]> {
  const due = await db.rpc("due_account_deletions");
  if (due.error) throw new Error(due.error.message);
  const ids = ((due.data ?? []) as { profile_id: string }[]).map((r) => r.profile_id);
  const out: DeletionResult[] = [];
  for (const id of ids) out.push(await processAccountDeletion(db, id));
  return out;
}
