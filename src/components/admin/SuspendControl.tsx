"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ReasonAction } from "./ReasonDialog";
import { restoreUser, suspendUser } from "@/app/[locale]/admin/actions";

export function SuspendControl({
  userId,
  suspended,
  self,
  isAdmin,
}: {
  userId: string;
  suspended: boolean;
  self: boolean;
  isAdmin: boolean;
}) {
  const t = useTranslations("admin.suspend");
  const [until, setUntil] = useState("");
  if (self) return <p className="m-0 text-sm text-text-2">{t("self")}</p>;
  if (suspended) {
    return (
      <ReasonAction
        label={t("restore")}
        tone="primary"
        consequence={t("restoreEffect")}
        action={(reason) => restoreUser(userId, reason)}
        successMessage={t("restored")}
      />
    );
  }
  return (
    <ReasonAction
      label={t("label")}
      tone="danger"
      consequence={
        <ul className="m-0 list-disc pl-5">
          <li>{t("e1")}</li>
          <li>{t("e2")}</li>
          <li>{t("e3")}</li>
          {isAdmin ? <li>{t("isAdmin")}</li> : null}
        </ul>
      }
      action={(reason) => suspendUser(userId, reason, until ? new Date(until + "T23:59:59").toISOString() : null)}
      successMessage={t("done")}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="suspend-until" className="text-sm font-semibold">
          {t("until")}
        </label>
        <input
          id="suspend-until"
          type="date"
          value={until}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setUntil(e.target.value)}
          className="min-h-[44px] rounded-[14px] border border-line-strong px-3.5"
        />
        <span className="text-[13px] text-text-2">{t("untilHint")}</span>
      </div>
    </ReasonAction>
  );
}
