"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { revokeAccess } from "@/app/actions/access";
import { cn } from "@/lib/cn";

export interface HolderRow {
  id: string;
  name: string;
  source: "open" | "approved_request";
  request_id: string | null;
  sinceLabel: string;
}

/** Active access holders. Revoking needs a written reason (15+ characters) that the person reads. */
export function HoldersList({ holders, teams }: { holders: HolderRow[]; teams: number }) {
  const t = useTranslations("settings.holders");
  const router = useRouter();
  return (
    <Card as="section" aria-labelledby="holders-h" className="flex flex-col gap-4">
      <h2 id="holders-h" className="m-0 text-xl">
        {t("title")}
      </h2>
      {holders.length === 0 ? (
        <p className="m-0 text-[15px] text-text-3">{t("empty")}</p>
      ) : (
        <>
          <p className="m-0 text-sm text-text-2">{t("count", { count: holders.length, teams })}</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {holders.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-line-soft bg-white p-3.5"
              >
                <span className="flex flex-col">
                  <strong>{h.name}</strong>
                  <span className="text-sm text-text-2">
                    {t("since", {
                      date: h.sinceLabel,
                      source: h.source === "open" ? t("sourceOpen") : t("sourceRequest"),
                    })}
                  </span>
                </span>
                <ConfirmDialog
                  trigger={t("revoke")}
                  title={t("revokeTitle", { name: h.name })}
                  effect={t("revokeEffect", { name: h.name })}
                  reasonLabel={t("reason")}
                  minReason={15}
                  confirmLabel={t("confirm")}
                  tone="danger"
                  triggerVariant="danger"
                  size="sm"
                  onConfirm={(reason) => revokeAccess(h.id, reason, h.request_id ?? undefined)}
                  onDone={() => router.refresh()}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export interface RequestRow {
  id: string;
  team: string;
  status: "pending" | "approved" | "declined" | "withdrawn" | "expired";
  statusLabel: string;
  purposeLabel: string;
  sentLabel: string;
  expiresLabel: string | null;
}

const FILTERS = ["all", "pending", "approved", "declined", "closed"] as const;
type Filter = (typeof FILTERS)[number];
const TONE = {
  pending: "warn",
  approved: "ok",
  declined: "neutral",
  withdrawn: "neutral",
  expired: "neutral",
} as const;

/** The owners' inbox: every request for this project, with filters. */
export function RequestInbox({ rows, openMode }: { rows: RequestRow[]; openMode: boolean }) {
  const t = useTranslations("settings.req");
  const [filter, setFilter] = useState<Filter>(rows.some((r) => r.status === "pending") ? "pending" : "all");
  const match = (r: RequestRow) =>
    filter === "all" ||
    (filter === "closed" ? r.status === "withdrawn" || r.status === "expired" : r.status === filter);
  const shown = rows.filter(match);
  const count = (f: Filter) =>
    rows.filter(
      (r) => f === "all" || (f === "closed" ? r.status === "withdrawn" || r.status === "expired" : r.status === f),
    ).length;

  return (
    <Card as="section" aria-labelledby="req-h" className="flex flex-col gap-4">
      <h2 id="req-h" className="m-0 text-xl">
        {t("title")}
      </h2>
      <div role="group" aria-label={t("filterLabel")} className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "chip-hover min-h-[44px] cursor-pointer rounded-full border-[1.5px] px-4 text-sm font-semibold",
              filter === f ? "border-blue bg-blue-tint text-blue-dark" : "border-line bg-white text-ink",
            )}
          >
            {t(f)} ({count(f)})
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="m-0 text-[15px] text-text-3">{rows.length === 0 && openMode ? t("emptyOpen") : t("empty")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {shown.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-line-soft bg-white p-3.5"
            >
              <span className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <strong>{r.team}</strong>
                  <Badge tone={TONE[r.status]}>{r.statusLabel}</Badge>
                </span>
                <span className="text-sm text-text-2">
                  {r.purposeLabel} · {t("sent", { date: r.sentLabel })}
                  {r.expiresLabel && r.status === "pending" ? ` · ${t("expires", { date: r.expiresLabel })}` : ""}
                </span>
              </span>
              <Link href={`/requests/${r.id}`} className="link-anim font-semibold text-blue">
                {t("open")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
