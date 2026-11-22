import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/guard";
import { toWitaInput } from "@/lib/admin/time";
import { statusText, type StatusTranslator } from "@/lib/admin/labels";
import { AnnouncementEditor } from "@/components/admin/AnnouncementEditor";
import { ReasonAction } from "@/components/admin/ReasonDialog";
import { EmptyState, PageHeader, Panel, StatusPill, Time, toneFor } from "@/components/admin/ui";
import { endAnnouncement } from "@/app/[locale]/admin/actions";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.announce" });
  return { title: t("title") };
}

interface Row {
  id: string;
  severity: "info" | "warning" | "critical";
  text_id: string;
  text_en: string;
  starts_at: string;
  ends_at: string | null;
  dismissible: boolean;
  ended_at: string | null;
  author_name: string | null;
  state: "scheduled" | "live" | "expired" | "ended";
}

/** Site-wide banners. Live ones show at the top of every public page, in the visitor's language. */
export default async function AdminAnnouncementsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  await requireAdmin();
  const [t, ts] = await Promise.all([getTranslations("admin.announce"), getTranslations("admin.status")]);
  const status = (k: string) => statusText(ts as unknown as StatusTranslator, k);
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_announcements_v")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as Row[];
  const editing = edit ? rows.find((r) => r.id === edit && r.state !== "ended") : undefined;

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <Panel title={editing ? t("editTitle") : t("newTitle")} className="mb-6">
        <AnnouncementEditor
          key={editing?.id ?? "new"}
          initial={
            editing
              ? {
                  id: editing.id,
                  severity: editing.severity,
                  textId: editing.text_id,
                  textEn: editing.text_en,
                  startsAt: toWitaInput(editing.starts_at),
                  endsAt: toWitaInput(editing.ends_at),
                  dismissible: editing.dismissible,
                }
              : undefined
          }
        />
        {editing ? (
          <p className="mb-0 mt-3 text-sm">
            <Link href="/admin/announcements">{t("cancelEdit")}</Link>
          </p>
        ) : null}
      </Panel>

      <Panel title={t("history", { count: rows.length })}>
        {rows.length === 0 ? (
          <EmptyState title={t("emptyTitle")} text={t("emptyText")} />
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={toneFor(r.state)}>{status(r.state)}</StatusPill>
                    <StatusPill
                      tone={r.severity === "critical" ? "danger" : r.severity === "warning" ? "warn" : "neutral"}
                    >
                      {status(r.severity)}
                    </StatusPill>
                    {r.dismissible ? null : <span className="text-text-2">{t("noDismiss")}</span>}
                  </span>
                  <span lang="id">{r.text_id}</span>
                  <span lang="en" className="text-text-2">
                    {r.text_en}
                  </span>
                  <span className="text-text-2">
                    {t("range")} <Time iso={r.starts_at} className="inline" />
                    {r.ends_at ? (
                      <>
                        {" "}
                        {t("rangeTo")} <Time iso={r.ends_at} className="inline" />
                      </>
                    ) : (
                      ` ${t("untilEnded")}`
                    )}
                    {r.author_name ? ` · ${t("by", { name: r.author_name })}` : ""}
                  </span>
                </div>
                {r.state === "live" || r.state === "scheduled" ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/announcements?edit=${r.id}`}
                      className="inline-flex min-h-[36px] items-center rounded-full border-[1.5px] border-line-strong bg-white px-3.5 text-[13px] font-semibold no-underline hover:bg-surface"
                    >
                      {t("edit")}
                    </Link>
                    <ReasonAction
                      small
                      label={t("endNow")}
                      consequence={t("endEffect")}
                      reasonLabel={t("endReason")}
                      action={endAnnouncement.bind(null, r.id)}
                      successMessage={t("ended")}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
