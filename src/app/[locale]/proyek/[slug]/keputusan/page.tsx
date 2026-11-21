import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { Breadcrumb, PageShell } from "@/components/ui/PageShell";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AppealForm } from "@/components/features/AppealForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "decision" });
  return { title: tm("metaTitle"), robots: { index: false } };
}

type Action = "hold" | "hide" | "remove" | "restore";
const TONE = { ok: "ok", held: "warn", hidden: "warn", removed: "danger" } as const;

/**
 * What the owners see about a moderation decision on their project: what happened, the reason, and the appeal.
 * Owners never see who reported (they cannot read reports at all, and decisions carry no reporter).
 */
export default async function DecisionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/proyek/${slug}/keputusan`);
  const [locale, t, ts] = await Promise.all([getLocale(), getTranslations("decision"), getTranslations("settings")]);

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, title, moderation_status")
    .eq("slug", slug)
    .maybeSingle();
  if (!project) notFound();
  const { data: owns } = await supabase.rpc("is_project_owner", { pid: project.id });
  if (owns !== true) notFound();
  void user;

  const [{ data: decisions }, { data: appeals }] = await Promise.all([
    supabase
      .from("moderation_decisions")
      .select("id, action, reason, automatic, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("moderation_appeals")
      .select("id, decision_id, body, status, resolution_note, created_at")
      .eq("project_id", project.id),
  ]);
  const list = (decisions ?? []) as {
    id: string;
    action: Action;
    reason: string;
    automatic: boolean;
    created_at: string;
  }[];
  const appealOf = new Map((appeals ?? []).map((a) => [a.decision_id as string, a]));
  const status = project.moderation_status as keyof typeof TONE;
  const latest = list[0];
  const canAppeal = !!latest && latest.action !== "restore" && status !== "ok" && !appealOf.has(latest.id);

  const reasonText = (d: (typeof list)[number]) => (d.automatic ? t("automaticReason") : d.reason);

  return (
    <PageShell width={820}>
      <Breadcrumb
        items={[
          { label: ts("breadcrumbDashboard"), href: "/dasbor" },
          { label: project.title, href: `/proyek/${slug}/pengaturan` },
          { label: t("title") },
        ]}
      />
      <h1 className="mb-2 mt-0 text-4xl font-medium max-sm:text-[28px]">{t("title")}</h1>
      <p className="mb-6 mt-0 text-text-2">{t("anonymity")}</p>

      <div className="flex flex-col gap-6">
        <Card as="section" aria-labelledby="state-h" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="state-h" className="m-0 text-xl">
              {project.title}
            </h2>
            <Badge tone={TONE[status]}>{t(`status.${status}`)}</Badge>
          </div>
          <p className="m-0 text-[15px] text-text-3">{t(`statusText.${status}`)}</p>
        </Card>

        {list.length === 0 ? (
          <Card tone="dashed" className="text-center text-text-2">
            {t("none")}
          </Card>
        ) : (
          <>
            <Card as="section" aria-labelledby="latest-h" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 id="latest-h" className="m-0 text-xl">
                  {t(`action.${latest.action}`)}
                </h2>
                <span className="text-sm text-text-2">{t("on", { date: formatDate(latest.created_at, locale) })}</span>
              </div>
              <p className="m-0 text-[15px]">
                <strong>{t("reasonLabel")}:</strong> {reasonText(latest)}
              </p>
              {appealOf.has(latest.id) ? <AppealStatus appeal={appealOf.get(latest.id)!} /> : null}
              {!canAppeal && !appealOf.has(latest.id) && latest.action === "restore" ? (
                <p className="m-0 text-sm text-text-2">{t("appeal.noneNeeded")}</p>
              ) : null}
            </Card>

            {canAppeal ? <AppealForm decisionId={latest.id} slug={slug} /> : null}

            {list.length > 1 ? (
              <Card as="section" aria-labelledby="history-h" className="flex flex-col gap-3">
                <h2 id="history-h" className="m-0 text-lg">
                  {t("history")}
                </h2>
                <ol className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
                  {list.slice(1).map((d) => (
                    <li key={d.id} className="flex flex-col gap-1 border-b border-line-soft pb-3">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong>{t(`action.${d.action}`)}</strong>
                        <span className="text-text-2">{t("on", { date: formatDate(d.created_at, locale) })}</span>
                      </span>
                      <span className="text-text-3">{reasonText(d)}</span>
                      {appealOf.has(d.id) ? <AppealStatus appeal={appealOf.get(d.id)!} /> : null}
                    </li>
                  ))}
                </ol>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </PageShell>
  );
}

async function AppealStatus({ appeal }: { appeal: { status: string; body: string; resolution_note: string | null } }) {
  const t = await getTranslations("decision.appeal");
  const label =
    appeal.status === "accepted"
      ? t("statusAccepted")
      : appeal.status === "rejected"
        ? t("statusRejected")
        : t("statusOpen");
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] bg-surface p-3.5 text-sm">
      <Badge tone={appeal.status === "accepted" ? "ok" : appeal.status === "rejected" ? "neutral" : "warn"}>
        {label}
      </Badge>
      <span className="text-text-3">
        <strong>{t("yours")}:</strong> {appeal.body}
      </span>
      {appeal.resolution_note ? (
        <span className="text-text-3">{t("note", { note: appeal.resolution_note })}</span>
      ) : null}
      {appeal.status !== "open" ? <span className="text-text-2">{t("once")}</span> : null}
    </div>
  );
}
