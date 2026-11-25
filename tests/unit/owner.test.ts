import { translator } from "./i18n-helpers";
import { describe, expect, it } from "vitest";
import { buildChecklist, resumeStep } from "@/lib/db/owner";
import { describeNotification } from "@/lib/db/dashboard";
import type { DraftItem, NotificationRow } from "@/lib/db/types";

const item = (review_status: DraftItem["review_status"]): DraftItem => ({
  id: crypto.randomUUID(),
  project_id: "p",
  run_id: null,
  kind: "next_task",
  title: "t",
  description: "",
  lesson_type: null,
  objective_status: null,
  evidence: [],
  evidence_status: "matched",
  origin: "ai",
  review_status,
  position: 0,
});
const member = (consented: boolean, status = "active") => ({
  consented_at: consented ? "2026-01-01T00:00:00Z" : null,
  status,
});

describe("buildChecklist", () => {
  it("is ready only when the team, the review and the policies are all done (there is no advisor step)", () => {
    expect(buildChecklist([member(true)], [item("kept")], { policiesAccepted: true }).canPublish).toBe(true);
    expect(buildChecklist([member(true)], [item("kept")], { policiesAccepted: false }).canPublish).toBe(false);
    expect(buildChecklist([member(true)], [item("pending")]).canPublish).toBe(false);
    expect(buildChecklist([member(false)], [item("kept")]).canPublish).toBe(false);
  });

  it("does not count removed items", () => {
    const checklist = buildChecklist([member(true)], [item("kept"), item("kept"), item("removed"), item("removed")]);
    expect(checklist.review).toEqual({ reviewed: 2, total: 2, kept: 2, done: true });
    expect(buildChecklist([member(true)], [item("removed")]).review).toEqual({
      reviewed: 0,
      total: 0,
      kept: 0,
      done: false,
    });
  });

  it("has no advisor entry at all", () => {
    expect(Object.keys(buildChecklist([member(true)], [item("kept")]))).toEqual([
      "team",
      "review",
      "policies",
      "canPublish",
    ]);
  });

  it("does not count a person who was invited but has not accepted", () => {
    const c = buildChecklist([member(true), member(false, "invited")], [item("kept")]);
    expect(c.team).toEqual({ confirmed: 1, total: 1, done: true });
    expect(buildChecklist([member(true), member(false, "active")], [item("kept")]).team.done).toBe(false);
  });

  it("needs at least one kept item", () => {
    expect(buildChecklist([member(true)], [item("removed")]).review.done).toBe(false);
    expect(buildChecklist([member(true)], []).review.done).toBe(false);
  });
});

describe("resumeStep", () => {
  const draft = { status: "draft" as const, title: "T", field: "Engineering" };
  it("resumes from what is done, not from a stored status", () => {
    expect(resumeStep({ ...draft, field: "" }, false, false)).toBe("info");
    expect(resumeStep(draft, false, false)).toBe("berkas");
    expect(resumeStep(draft, true, false)).toBe("berkas");
    expect(resumeStep(draft, true, true)).toBe("tinjau");
  });
  it("sends the manual path straight to the review, and keeps reviewing once items exist", () => {
    expect(resumeStep({ ...draft, fill_mode: "manual" }, false, false)).toBe("tinjau");
    expect(resumeStep({ ...draft, fill_mode: "ai" }, true, false)).toBe("berkas");
    expect(resumeStep({ ...draft, fill_mode: "manual" }, false, true)).toBe("tinjau");
  });
  it("sends anything that is not a draft to the preview and publish step", () => {
    for (const status of ["published", "unpublished", "archived"] as const)
      expect(resumeStep({ ...draft, status }, true, true)).toBe("terbit");
  });
});

describe("describeNotification", () => {
  const t = translator("dashboard");
  const n = (type: string, payload: Record<string, unknown>): NotificationRow => ({
    id: "n",
    user_id: "u",
    type,
    payload,
    read_at: null,
    created_at: "2026-01-01T00:00:00Z",
  });
  it("describes the new access events and sends people to the new dashboard", () => {
    expect(describeNotification(n("access_taken", { title: "P", name: "Sam" }), t).text).toBe("Sam took access to P.");
    const revoked = describeNotification(n("access_revoked", { title: "P", reason: "Scope changed." }), t);
    expect(revoked.detail).toContain("Scope changed.");
    expect(revoked.href).toBe("/dasbor");
    expect(describeNotification(n("team_invite", { title: "P" }), t).href).toBe("/dasbor#undangan");
    expect(describeNotification(n("request_expired", { title: "P", team: "T", request_id: "r1" }), t).href).toBe(
      "/requests/r1",
    );
  });
  it("never points at the old dashboard path", () => {
    for (const type of ["moderation", "break_glass", "unknown_type", "access_taken", "access_revoked"]) {
      expect(describeNotification(n(type, { title: "P" }), t).href).not.toContain("/dashboard");
    }
  });
});

describe("describeNotification (R4 events)", () => {
  const t = translator("dashboard");
  const n = (type: string, payload: Record<string, unknown>): NotificationRow => ({
    id: "n",
    user_id: "u",
    type,
    payload,
    read_at: null,
    created_at: "2026-01-01T00:00:00Z",
  });
  it("sends watchers to the project, and says why access opened", () => {
    const mode = describeNotification(n("watch_open", { title: "P", slug: "p-slug", reason: "mode" }), t);
    expect(mode.text).toBe("P is open for continuation again.");
    expect(mode.detail).toBe("The owners opened access again.");
    expect(mode.href).toBe("/projects/p-slug");
    expect(describeNotification(n("watch_open", { title: "P", slug: "p", reason: "quota" }), t).detail).toBe(
      "A team slot is free.",
    );
  });
  it("describes thread replies, task progress, reminders and ownership offers with working links", () => {
    expect(
      describeNotification(n("request_reply", { title: "P", team: "Tim A", request_id: "r1", message: "Hi" }), t).href,
    ).toBe("/requests/r1");
    const p = describeNotification(
      n("item_progress", { title: "P", slug: "p", task: "Clean data", status: "done" }),
      t,
    );
    expect(p.text).toBe("The task “Clean data” in P is now done.");
    expect(p.href).toBe("/projects/p/workspace");
    expect(
      describeNotification(
        n("request_expiring", { title: "P", team: "Tim A", request_id: "r1", expires_at: "2026-12-24T00:00:00Z" }),
        t,
      ).detail,
    ).toContain("2026-12-24");
    expect(describeNotification(n("ownership_offer", { title: "P", slug: "p" }), t).href).toBe("/proyek/p/pengaturan");
  });
});
