"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, FolderPlus, Inbox, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { CountUp, Stagger, StaggerItem } from "@/components/ui/motion";
import { markNotificationsRead } from "@/app/actions/requests";
import { REQUEST_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import type { DashboardData, DashboardProject, DashboardRequest } from "@/lib/db/dashboard";

const STAGES = ["Draft", "Advisor approval", "Verify", "Published", "Continued"];

function StageBars({ current }: { current: number }) {
  return (
    <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(130px,100%),1fr))] gap-2 p-0" aria-label="Project stage">
      {STAGES.map((label, i) => (
        <li key={label} className="flex flex-col gap-1.5" aria-current={i === current ? "step" : undefined}>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <motion.div
              className="h-1.5 rounded-full bg-blue"
              initial={{ width: 0 }}
              animate={{ width: i <= current ? "100%" : "0%" }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className={cn("text-[13px]", i === current ? "font-semibold text-ink" : "font-medium text-text-2")}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function ProjectRow({ p }: { p: DashboardProject }) {
  return (
    <StaggerItem>
      <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="mb-1 mt-0 text-[22px]">
                <Link href={`/projects/${p.slug}`} className="text-ink no-underline hover:underline">
                  {p.title}
                </Link>
              </h2>
              <span className="text-sm text-text-2">{p.meta}</span>
              {p.isDemo ? (
                <span className="ml-2 align-middle">
                  <DemoBadge />
                </span>
              ) : null}
            </div>
            <ButtonLink href={p.href} variant={p.ctaTone === "lime" ? "primary" : p.ctaTone === "blue" ? "darkSolid" : "outline"} size="md" className={p.ctaTone === "blue" ? "!bg-blue" : ""}>
              {p.cta}
            </ButtonLink>
          </div>
          <StageBars current={p.stage} />
          <div className={cn("rounded-[14px] px-4 py-3 text-[15px] text-text-3", p.noteTone === "warn" ? "bg-warn-bg" : p.noteTone === "blue" ? "bg-blue-tint" : "bg-chip")}>{p.note}</div>
        </Card>
      </motion.div>
    </StaggerItem>
  );
}

function RequestRow({ r, received }: { r: DashboardRequest; received: boolean }) {
  const tone = r.status === "approved" ? "ok" : r.status === "pending" ? "warn" : "neutral";
  const label = received && r.status === "pending" ? "Waiting for your decision" : r.status === "pending" ? "Waiting for the creators" : r.unlocked ? "Files unlocked" : REQUEST_STATUS_LABEL[r.status];
  return (
    <StaggerItem>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <strong>{r.projectTitle}</strong>
          <br />
          <span className="text-sm text-text-2">
            {received ? `${r.team} · ` : ""}
            {r.meta}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={r.unlocked ? "ok" : tone}>{label}</Badge>
          {r.needsAgreement ? <Badge tone="lime">Accept the agreement</Badge> : null}
          <ButtonLink href={r.unlocked && !received ? `/projects/${r.projectSlug}/workspace` : `/requests/${r.id}`} variant="outline" size="md">
            {received && r.status === "pending" ? "Review" : r.unlocked && !received ? "Open workspace" : "Open"}
          </ButtonLink>
        </div>
      </Card>
    </StaggerItem>
  );
}

function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-line-strong bg-surface p-10 text-center">
      {icon}
      <h2 className="m-0 text-xl font-medium">{title}</h2>
      <p className="m-0 max-w-sm text-text-2">{text}</p>
      {action}
    </div>
  );
}

export function Dashboard({ data, initialTab }: { data: DashboardData; initialTab: string }) {
  const router = useRouter();
  const group = useId();
  const [tab, setTab] = useState(["projects", "requests", "notifications"].includes(initialTab) ? initialTab : "projects");
  const [, start] = useTransition();
  const unread = data.notifications.filter((n) => n.unread).length;

  const tiles = [
    { n: data.tiles.decisions, label: data.tiles.decisions === 1 ? "Request waiting for your decision" : "Requests waiting for your decision", cls: "bg-warn-bg text-warn" },
    { n: data.tiles.drafts, label: data.tiles.drafts === 1 ? "Draft waiting for your review" : "Drafts waiting for your review", cls: "bg-blue-tint text-blue-dark" },
    { n: data.tiles.sentPending, label: data.tiles.sentPending === 1 ? "Request you sent, still pending" : "Requests you sent, still pending", cls: "bg-surface text-ink" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <Stagger className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
        {tiles.map((t) => (
          <StaggerItem key={t.label} className={cn("rounded-[28px] p-5", t.cls)}>
            <div className="text-4xl font-medium leading-none">
              <CountUp to={t.n} />
            </div>
            <div className="mt-2 font-semibold text-ink">{t.label}</div>
          </StaggerItem>
        ))}
      </Stagger>

      <div>
        <SegmentedTabs
          label="Dashboard sections"
          value={tab}
          onChange={(id) => {
            setTab(id);
            window.history.replaceState(null, "", `?tab=${id}`);
          }}
          tabs={[
            { id: "projects", label: "My projects" },
            { id: "requests", label: "My requests", count: data.received.filter((r) => r.status === "pending").length },
            { id: "notifications", label: "Notifications", count: unread },
          ]}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} role="tabpanel" id={`${group}-panel-${tab}`}>
          {tab === "projects" ? (
            data.projects.length === 0 ? (
              <Empty
                icon={<FolderPlus size={36} className="text-blue" aria-hidden="true" />}
                title="You have not shared a project yet"
                text="Finished or paused a project? Give it a second life, with your team and advisor on board."
                action={
                  <ButtonLink href="/share" arrow>
                    Share a project
                  </ButtonLink>
                }
              />
            ) : (
              <Stagger className="flex flex-col gap-4">
                {data.projects.map((p) => (
                  <ProjectRow key={p.id} p={p} />
                ))}
              </Stagger>
            )
          ) : null}

          {tab === "requests" ? (
            <div className="flex flex-col gap-8">
              <section className="flex flex-col gap-3" aria-labelledby="recv-h">
                <h2 id="recv-h" className="m-0 text-[22px]">
                  Requests for your projects
                </h2>
                {data.received.length === 0 ? (
                  <Empty icon={<Inbox size={32} className="text-text-2" aria-hidden="true" />} title="No requests yet" text="When a team asks to continue one of your projects, it appears here." />
                ) : (
                  <Stagger className="flex flex-col gap-3">
                    {data.received.map((r) => (
                      <RequestRow key={r.id} r={r} received />
                    ))}
                  </Stagger>
                )}
              </section>
              <section className="flex flex-col gap-3" aria-labelledby="sent-h">
                <h2 id="sent-h" className="m-0 text-[22px]">
                  Requests you sent
                </h2>
                {data.sent.length === 0 ? (
                  <Empty
                    icon={<Send size={32} className="text-text-2" aria-hidden="true" />}
                    title="You have not sent a request"
                    text="Browse verified projects and ask to continue one."
                    action={<ButtonLink href="/explore">Explore projects</ButtonLink>}
                  />
                ) : (
                  <Stagger className="flex flex-col gap-3">
                    {data.sent.map((r) => (
                      <RequestRow key={r.id} r={r} received={false} />
                    ))}
                  </Stagger>
                )}
              </section>
            </div>
          ) : null}

          {tab === "notifications" ? (
            data.notifications.length === 0 ? (
              <Empty icon={<Bell size={32} className="text-text-2" aria-hidden="true" />} title="You are all caught up" text="Advisor decisions, new requests and agreement updates show up here." />
            ) : (
              <div className="flex flex-col gap-3">
                {unread > 0 ? (
                  <Button
                    variant="outline"
                    size="md"
                    className="self-start"
                    onClick={() =>
                      start(async () => {
                        await markNotificationsRead([]);
                        router.refresh();
                      })
                    }
                  >
                    Mark all as read
                  </Button>
                ) : null}
                <Stagger as="ul" className="m-0 flex list-none flex-col gap-3 p-0">
                  {data.notifications.map((n) => (
                    <StaggerItem key={n.id} as="li">
                      <Link
                        href={n.href}
                        onClick={() => n.unread && start(async () => { await markNotificationsRead([n.id]); })}
                        className={cn(
                          "flex flex-col gap-1 rounded-3xl border p-4 text-ink no-underline transition-colors hover:bg-surface",
                          n.unread ? "border-lime bg-white" : "border-line-soft bg-white",
                        )}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <strong>{n.text}</strong>
                          <span className="whitespace-nowrap text-[13px] text-text-2">{n.when}</span>
                        </span>
                        {n.detail ? <span className="text-sm text-text-2">{n.detail}</span> : null}
                        {n.unread ? <Badge tone="lime" className="mt-1 self-start">New</Badge> : null}
                      </Link>
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
            )
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
