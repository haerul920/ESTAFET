"use client";

import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Check, Circle, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { PublishChecklist as Checklist } from "@/lib/db/owner";
import { cn } from "@/lib/cn";

function Mark({ state }: { state: "done" | "warn" | "todo" }) {
  const cls =
    state === "done" ? "bg-ok-bg text-ok" : state === "warn" ? "bg-warn-bg text-warn" : "bg-chip text-text-2";
  return (
    <motion.span
      key={state}
      initial={{ scale: 0.6 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
      aria-hidden="true"
      className={cn("flex h-6 w-6 flex-none items-center justify-center rounded-full font-semibold", cls)}
    >
      {state === "done" ? <Check size={14} strokeWidth={3} /> : state === "warn" ? <TriangleAlert size={13} /> : <Circle size={8} />}
    </motion.span>
  );
}

/** The right-rail "Before you can publish" card. Reflects the real database state. */
export function PublishChecklist({
  projectId,
  checklist,
  step,
}: {
  projectId: string;
  checklist: Checklist;
  step: string;
}) {
  const t = useTranslations("checklist");
  const { team, review, policies } = checklist;
  return (
    <Card as="aside" aria-label={t("title")}>
      <h2 className="mb-4 mt-0 text-lg">{t("title")}</h2>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        <li className="flex gap-3">
          <Mark state={team.done ? "done" : "warn"} />
          <span>
            <strong>{team.done ? t("teamDone") : t("teamPending")}</strong>
            <br />
            <span className="text-sm text-text-2">
              {t("teamCount", { confirmed: team.confirmed, total: team.total })}
            </span>
            {!team.done && step !== "tim" ? (
              <>
                <br />
                <Link href={`/bagikan/${projectId}/tim`} className="text-sm font-semibold">
                  {t("goConsent")}
                </Link>
              </>
            ) : null}
          </span>
        </li>
        <li className="flex gap-3">
          <Mark state={review.done ? "done" : review.total > 0 ? "warn" : "todo"} />
          <span>
            <strong>{t("reviewTitle")}</strong>
            <br />
            <span className="text-sm text-text-2">
              {review.total === 0 ? t("reviewNone") : t("reviewCount", { reviewed: review.reviewed, total: review.total })}
            </span>
          </span>
        </li>
        <li className="flex gap-3">
          <Mark state={policies.done ? "done" : "warn"} />
          <span>
            <strong>{policies.done ? t("policiesOk") : t("policiesNo")}</strong>
            <br />
            <span className="text-sm text-text-2">{policies.done ? t("policiesOkText") : t("policiesNoText")}</span>
          </span>
        </li>
      </ul>
    </Card>
  );
}
