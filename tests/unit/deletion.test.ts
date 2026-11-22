import { describe, expect, it } from "vitest";
import {
  processAccountDeletion,
  processDueDeletions,
  scrubbedEmail,
  type DeletionClient,
} from "@/lib/account/deletion";

interface Calls {
  rpc: string[];
  removed: Record<string, string[]>;
  deletedProjects: string[];
  authUpdates: Record<string, unknown>[];
}

/** A tiny in-memory stand-in for the service-role client. */
function fakeClient(opts: { drafts?: string[]; anonymizeError?: string; authError?: string; due?: string[] } = {}) {
  const calls: Calls = { rpc: [], removed: {}, deletedProjects: [], authUpdates: [] };
  const ok = { error: null };
  const db: DeletionClient = {
    rpc: async (fn) => {
      calls.rpc.push(fn);
      if (fn === "due_account_deletions")
        return { data: (opts.due ?? []).map((id) => ({ profile_id: id })), error: null };
      if (opts.anonymizeError) return { data: null, error: { message: opts.anonymizeError } };
      return { data: { draft_projects: opts.drafts ?? [] }, error: null };
    },
    from: (table: string) => ({
      select: () => ({
        eq: async () => ({
          data:
            table === "project_files"
              ? [
                  { storage_path: "p1/a.pdf", extracted_text_path: "p1/a.json" },
                  { storage_path: "p1/b.md", extracted_text_path: null },
                ]
              : [],
          error: null,
        }),
      }),
      delete: () => ({
        eq: async (_c: string, id: string) => {
          calls.deletedProjects.push(id);
          return ok;
        },
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          calls.removed[bucket] = [...(calls.removed[bucket] ?? []), ...paths];
          return ok;
        },
      }),
    },
    auth: {
      admin: {
        updateUserById: async (_id: string, attrs: Record<string, unknown>) => {
          calls.authUpdates.push(attrs);
          return opts.authError ? { error: { message: opts.authError } } : ok;
        },
      },
    },
  };
  return { db, calls };
}

describe("account deletion", () => {
  it("removes the files and rows of sole-owned drafts and scrubs the sign-in record", async () => {
    const { db, calls } = fakeClient({ drafts: ["d1", "d2"] });
    const r = await processAccountDeletion(db, "u1");
    expect(r).toMatchObject({ ok: true, draftsDeleted: 2, filesRemoved: 6 });
    expect(calls.removed["project-files"]).toEqual(["p1/a.pdf", "p1/b.md", "p1/a.pdf", "p1/b.md"]);
    expect(calls.removed["extracted-text"]).toEqual(["p1/a.json", "p1/a.json"]);
    expect(calls.deletedProjects).toEqual(["d1", "d2"]);
    const scrub = calls.authUpdates[0];
    expect(scrub.email).toBe(scrubbedEmail("u1"));
    expect(scrub.email).toMatch(/@deleted\.invalid$/);
    expect(scrub.ban_duration).toBe("876000h");
    expect(String(scrub.password)).toHaveLength(64);
  });

  it("uses a different random password every time", async () => {
    const a = fakeClient();
    const b = fakeClient();
    await processAccountDeletion(a.db, "u1");
    await processAccountDeletion(b.db, "u1");
    expect(a.calls.authUpdates[0].password).not.toBe(b.calls.authUpdates[0].password);
  });

  it("does nothing else when the database refuses (nothing is due)", async () => {
    const { db, calls } = fakeClient({ anonymizeError: "No deletion is due", drafts: ["d1"] });
    const r = await processAccountDeletion(db, "u1");
    expect(r.ok).toBe(false);
    expect(calls.deletedProjects).toEqual([]);
    expect(calls.authUpdates).toEqual([]);
  });

  it("reports a failed sign-in scrub without hiding that drafts were already removed", async () => {
    const { db } = fakeClient({ drafts: ["d1"], authError: "auth down" });
    const r = await processAccountDeletion(db, "u1");
    expect(r).toMatchObject({ ok: false, draftsDeleted: 1, error: "auth down" });
  });

  it("processes every due account", async () => {
    const { db, calls } = fakeClient({ due: ["u1", "u2", "u3"] });
    const results = await processDueDeletions(db);
    expect(results.map((r) => r.profileId)).toEqual(["u1", "u2", "u3"]);
    expect(calls.authUpdates).toHaveLength(3);
  });
});
