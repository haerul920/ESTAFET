"use client";

import { useState } from "react";
import { ReasonAction } from "./ReasonDialog";
import { restoreUser, suspendUser } from "@/app/admin/actions";

export function SuspendControl({ userId, suspended, self, isAdmin }: { userId: string; suspended: boolean; self: boolean; isAdmin: boolean }) {
  const [until, setUntil] = useState("");
  if (self) return <p className="m-0 text-sm text-text-2">You cannot suspend yourself.</p>;
  if (suspended) {
    return (
      <ReasonAction
        label="Restore access"
        tone="primary"
        consequence={<>The user can sign in and act again. This is recorded in the audit log.</>}
        action={(reason) => restoreUser(userId, reason)}
        successMessage="User restored."
      />
    );
  }
  return (
    <ReasonAction
      label="Suspend user"
      tone="danger"
      consequence={
        <ul className="m-0 list-disc pl-5">
          <li>The user cannot sign in or act (share, request, upload, download).</li>
          <li>Their published teasers stay visible unless you moderate them separately.</li>
          <li>You can restore access at any time. Needs a recent password check.</li>
          {isAdmin ? <li>This account is an admin.</li> : null}
        </ul>
      }
      action={(reason) => suspendUser(userId, reason, until ? new Date(until + "T23:59:59").toISOString() : null)}
      successMessage="User suspended."
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="suspend-until" className="text-sm font-semibold">Suspend until (optional)</label>
        <input id="suspend-until" type="date" value={until} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} className="min-h-[44px] rounded-[14px] border border-line-strong px-3.5" />
        <span className="text-[13px] text-text-2">Leave empty to suspend until you restore the account.</span>
      </div>
    </ReasonAction>
  );
}
