import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { loadSettings } from "@/lib/db/settings";
import { visibleEvents } from "@/lib/lineage";
import { getFiles, getItems, resumeStep } from "@/lib/db/owner";
import { describeNotification } from "@/lib/db/dashboard";
import { formatDate, formatDateTime } from "@/lib/format";
import { getLabels } from "@/lib/get-labels";
import type { TFn } from "@/lib/labels";
import type { NotificationRow } from "@/lib/db/types";
import { PageShell, Breadcrumb } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { AccessSettings } from "@/components/features/AccessSettings";
import { PublicationControls } from "@/components/features/settings/PublicationControls";
import { TeamControls } from "@/components/features/settings/TeamControls";
import { HoldersList, RequestInbox } from "@/components/features/settings/HoldersAndRequests";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "settings" });
  return { title: tm("metaTitle"), robots: { index: false } };
}

export default async function ProjectSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/proyek/${slug}/pengaturan`);
  const [locale, t, td, tl, L] = await Promise.all([
    getLocale(),
    getTranslations("settings"),
    getTranslations("dashboard"),
    getTranslations("lineage"),
    getLabels(),
  ]);
  const data = await loadSettings(slug, user.id);
  if (!data) notFound();
  const { project } = data;

  const [files, items] = await Promise.all([getFiles(project.id), getItems(project.id)]);
  const resumeHref = `/bagikan/${project.id}/${resumeStep(project, files.length > 0, items.length > 0)}`;
  const teams = new Set(data.holders.map((h) => h.request_id ?? h.id)).size;
  const moderated = (project.moderation_status ?? "ok") !== "ok";
  const published = project.status === "published";

  return (
    <PageShell width={880}>
      <Breadcrumb
        items={[
          { label: t("breadcrumbDashboard"), href: "/dasbor" },
          { label: project.title, href: published ? `/projects/${project.slug}` : undefined },
          { label: t("title") },
        ]}
      />
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-2 mt-0 text-4xl font-medium max-sm:text-[28px]">{t("title")}</h1>
          <p className="m-0 max-w-[620px] text-text-2">{t("lead")}</p>
        </div>
        <ButtonLink
          href={published ? `/projects/${project.slug}?as=visitor` : `/bagikan/${project.id}/terbit`}
          variant="outline"
        >
          {t("previewVisitor")}
        </ButtonLink>
      </div>

      <div className="flex flex-col gap-6">
        <PublicationControls
          projectId={project.id}
          slug={project.slug}
          status={project.status}
          moderated={moderated}
          resumeHref={resumeHref}
        />

        {project.status === "archived" ? null : (
          <AccessSettings
            projectId={project.id}
            mode={project.access_mode}
            max={project.max_active_adopters}
            watchers={data.watchers}
          />
        )}

        <TeamControls
          projectId={project.id}
          currentUserId={user.id}
          isPrimaryOwner={data.isPrimaryOwner}
          transfer={data.transfer}
          team={data.team.map((m) => ({
            profile_id: m.profile_id,
            full_name: m.full_name,
            role: m.role,
            status: m.status,
          }))}
        />

        <RequestInbox
          openMode={project.access_mode === "open"}
          rows={data.requests.map((r) => ({
            id: r.id,
            team: r.adopter_team_name,
            status: r.status,
            statusLabel: L.requestStatus[r.status],
            purposeLabel: L.purpose[r.purpose as keyof typeof L.purpose] ?? r.purpose,
            sentLabel: formatDate(r.created_at, locale),
            expiresLabel: r.expires_at ? formatDate(r.expires_at, locale) : null,
          }))}
        />

        <HoldersList
          teams={teams}
          holders={data.holders.map((h) => ({
            id: h.id,
            name: h.name || "—",
            source: h.source,
            request_id: h.request_id,
            sinceLabel: formatDate(h.accepted_at, locale),
          }))}
        />

        <Card as="section" aria-labelledby="notes-h" className="flex flex-col gap-3">
          <h2 id="notes-h" className="m-0 text-xl">
            {t("notes.title")}
          </h2>
          {data.notifications.length === 0 ? (
            <p className="m-0 text-[15px] text-text-3">{t("notes.empty")}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {data.notifications.map((n) => {
                const d = describeNotification(n as unknown as NotificationRow, td as unknown as TFn);
                return (
                  <li key={n.id} className="rounded-[18px] border border-line-soft bg-white p-3.5 text-sm">
                    <Link href={d.href} className="font-semibold text-ink no-underline hover:underline">
                      {d.text}
                    </Link>
                    {d.detail ? <span className="block text-text-2">{d.detail}</span> : null}
                    <span className="block text-[13px] text-muted">{formatDateTime(n.created_at, locale)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card as="section" aria-labelledby="history-h" className="flex flex-col gap-3">
          <h2 id="history-h" className="m-0 text-xl">
            {t("history.title")}
          </h2>
          <p className="m-0 text-sm text-text-2">{t("history.text")}</p>
          {data.events.length === 0 ? (
            <p className="m-0 text-[15px] text-text-3">{t("history.empty")}</p>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
              {visibleEvents(data.events).map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 border-b border-line-soft py-1.5">
                  <span>{tl(`events.${e.type}`)}</span>
                  <span className="text-text-2">{formatDateTime(e.created_at, locale)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
