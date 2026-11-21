"use client";

import { useState } from "react";
import { ReasonAction } from "@/components/admin/ReasonDialog";
import { saveAnnouncement, type AnnouncementInput } from "@/app/[locale]/admin/actions";
import { fromWitaInput } from "@/lib/admin/time";

export interface AnnouncementDraft {
  id: string | null;
  severity: AnnouncementInput["severity"];
  textId: string;
  textEn: string;
  /** `datetime-local` values in WITA. */
  startsAt: string;
  endsAt: string;
  dismissible: boolean;
}

const EMPTY: AnnouncementDraft = {
  id: null,
  severity: "info",
  textId: "",
  textEn: "",
  startsAt: "",
  endsAt: "",
  dismissible: true,
};

const FIELD = "w-full rounded-[14px] border border-line-strong bg-white px-3.5 py-2.5 text-[15px]";

/** Create or edit a site-wide announcement. Both languages are required: visitors see the one for their language. */
export function AnnouncementEditor({ initial, onDone }: { initial?: AnnouncementDraft; onDone?: () => void }) {
  const [d, setD] = useState<AnnouncementDraft>(initial ?? EMPTY);
  const set = <K extends keyof AnnouncementDraft>(k: K, v: AnnouncementDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const ready = d.textId.trim().length >= 3 && d.textEn.trim().length >= 3;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ann-id" className="text-sm font-semibold">
            Text in Indonesian
          </label>
          <textarea
            id="ann-id"
            rows={3}
            maxLength={280}
            value={d.textId}
            onChange={(e) => set("textId", e.target.value)}
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ann-en" className="text-sm font-semibold">
            Text in English
          </label>
          <textarea
            id="ann-en"
            rows={3}
            maxLength={280}
            value={d.textEn}
            onChange={(e) => set("textEn", e.target.value)}
            className={FIELD}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ann-sev" className="text-sm font-semibold">
            Severity
          </label>
          <select
            id="ann-sev"
            value={d.severity}
            onChange={(e) => set("severity", e.target.value as AnnouncementDraft["severity"])}
            className={FIELD}
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ann-start" className="text-sm font-semibold">
            Starts (WITA)
          </label>
          <input
            id="ann-start"
            type="datetime-local"
            value={d.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
            className={FIELD}
          />
          <span className="text-[13px] text-text-2">Empty means now.</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ann-end" className="text-sm font-semibold">
            Ends (WITA)
          </label>
          <input
            id="ann-end"
            type="datetime-local"
            value={d.endsAt}
            onChange={(e) => set("endsAt", e.target.value)}
            className={FIELD}
          />
          <span className="text-[13px] text-text-2">Empty means until you end it.</span>
        </div>
      </div>
      <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={d.dismissible}
          onChange={(e) => set("dismissible", e.target.checked)}
          className="h-5 w-5 accent-[var(--blue)]"
        />
        <span className="text-sm">Visitors can dismiss it</span>
      </label>
      <div>
        <ReasonAction
          label={d.id ? "Save changes" : "Publish announcement"}
          tone="primary"
          disabled={!ready}
          consequence={
            <>
              The announcement shows as a banner at the top of every public page, in the visitor&apos;s language, from
              the start time until the end time. It pushes content down and never covers it.
            </>
          }
          reasonLabel="Why this announcement is needed (kept in the audit log)"
          successMessage={d.id ? "Announcement saved." : "Announcement published."}
          action={(reason) =>
            saveAnnouncement(
              {
                id: d.id,
                severity: d.severity,
                textId: d.textId,
                textEn: d.textEn,
                startsAt: fromWitaInput(d.startsAt),
                endsAt: fromWitaInput(d.endsAt),
                dismissible: d.dismissible,
              },
              reason,
            )
          }
          onDone={() => {
            if (!d.id) setD(EMPTY);
            onDone?.();
          }}
        />
      </div>
    </div>
  );
}
