"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Bell, Check } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { markAllNotificationsRead, markNotificationsRead } from "@/app/actions/requests";
import { respondToInvite } from "@/app/actions/projects";
import { cn } from "@/lib/cn";
import type { DashboardNotification } from "@/lib/db/dashboard";

function InviteNotificationCard({ n }: { n: DashboardNotification }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  function answer(accept: boolean) {
    if (!n.inviteProjectId) return;
    const projectId = n.inviteProjectId;
    start(async () => {
      setError("");
      const r = await respondToInvite(projectId, accept);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-3xl border p-5 text-ink",
        n.unread ? "border-lime bg-white" : "border-line-soft bg-white",
      )}
    >
      <div className="flex flex-col gap-1.5">
        <span className="flex items-start justify-between gap-3">
          <strong>{n.text}</strong>
          <span className="whitespace-nowrap text-[13px] text-text-2">{n.when}</span>
        </span>
        {n.detail ? <span className="text-sm text-text-2">{n.detail}</span> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {n.unread ? <Badge tone="lime">{t("new")}</Badge> : null}
          {n.inviteStatus === "active" ? (
            <Badge tone="ok">
              <Check size={14} aria-hidden="true" /> {t("inviteAcceptedBadge")}
            </Badge>
          ) : n.inviteStatus === "left" ? (
            <Badge tone="neutral">{t("inviteDeclinedBadge")}</Badge>
          ) : null}
        </div>
        {n.inviteStatus === "invited" ? (
          <div className="flex flex-wrap gap-2">
            <Button size="md" loading={pending} disabled={pending} onClick={() => answer(true)}>
              {t("accept")}
            </Button>
            <Button variant="outline" size="md" loading={pending} disabled={pending} onClick={() => answer(false)}>
              {t("decline")}
            </Button>
          </div>
        ) : null}
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}

export function NotificationsList({ items }: { items: DashboardNotification[] }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = items.filter((n) => n.unread).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-[40px] font-medium max-sm:text-[30px]">{t("notifications")}</h1>
            {unread > 0 ? <Badge tone="lime">{t("unreadCount", { count: unread })}</Badge> : null}
          </div>
          <p className="m-0 text-text-2">{t("caughtUpText")}</p>
        </div>
        {unread > 0 ? (
          <Button
            variant="outline"
            size="md"
            loading={pending}
            disabled={pending}
            onClick={() =>
              start(async () => {
                await markAllNotificationsRead();
                router.refresh();
              })
            }
          >
            {t("markAll")}
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-line-strong bg-surface p-10 text-center">
          <Bell size={32} className="text-text-2" aria-hidden="true" />
          <h2 className="m-0 text-xl font-medium">{t("caughtUpTitle")}</h2>
          <p className="m-0 max-w-sm text-text-2">{t("caughtUpText")}</p>
        </div>
      ) : (
        <Stagger as="ul" className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((n) => (
            <StaggerItem key={n.id} as="li">
              {n.inviteProjectId ? (
                <InviteNotificationCard n={n} />
              ) : (
                <Link
                  href={n.href}
                  onClick={() =>
                    n.unread &&
                    start(async () => {
                      await markNotificationsRead([n.id]);
                    })
                  }
                  className={cn(
                    "flex flex-col gap-1.5 rounded-3xl border p-5 text-ink no-underline transition-colors hover:bg-surface",
                    n.unread ? "border-lime bg-white" : "border-line-soft bg-white",
                  )}
                >
                  <span className="flex items-start justify-between gap-3">
                    <strong>{n.text}</strong>
                    <span className="whitespace-nowrap text-[13px] text-text-2">{n.when}</span>
                  </span>
                  {n.detail ? <span className="text-sm text-text-2">{n.detail}</span> : null}
                  {n.unread ? (
                    <Badge tone="lime" className="mt-1 self-start">
                      {t("new")}
                    </Badge>
                  ) : null}
                </Link>
              )}
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
