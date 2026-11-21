import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Download, FileArchive, FileCode2, FileText, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReadPrivate, isProjectOwner } from "@/lib/db/access";
import { PageShell, Breadcrumb } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Badge, DemoBadge, EvidenceChip } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Lineage } from "@/components/features/Lineage";
import { ProgressControl } from "@/components/features/ProgressControl";
import { CreditLineCard } from "@/components/features/RequestReview";
import { Reveal } from "@/components/ui/motion";
import { buildFullLineage } from "@/lib/lineage";
import { creditLine } from "@/lib/agreement/terms";
import { getLabels } from "@/lib/get-labels";
import type { TFn } from "@/lib/labels";
import type { DraftItem, LineageEvent, ProjectFile } from "@/lib/db/types";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "workspace" });
  return { title: tm("metaTitle"), robots: { index: false } };
}

export default async function WorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireUser(`/projects/${slug}/workspace`);
  const [locale, t, ag, tl, L] = await Promise.all([
    getLocale(),
    getTranslations("workspace"),
    getTranslations("agreement"),
    getTranslations("lineage"),
    getLabels(),
  ]);
  // Basic project facts come from the server (an unpublished project is not in the public view, but its access holders keep working).
  const { data: teaser } = await createAdminClient()
    .from("projects")
    .select("id, slug, title, is_demo, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!teaser) notFound();

  // The database decides: an owner, or a person who holds active access.
  if (!(await canReadPrivate(teaser.id))) redirect({ href: `/projects/${slug}?locked=1`, locale });
  const owner = await isProjectOwner(teaser.id);

  const supabase = await createClient();
  const [{ data: files }, { data: items }, { data: ownEvents }, { data: publicEvents }, { data: members }, { data: progress }] = await Promise.all([
    supabase.from("project_files").select("*").eq("project_id", teaser.id).order("created_at"),
    supabase.from("draft_items").select("*").eq("project_id", teaser.id).eq("review_status", "kept").order("position"),
    supabase.from("lineage_events").select("*").eq("project_id", teaser.id).order("created_at"),
    supabase.from("public_project_lineage").select("*").eq("project_id", teaser.id).order("created_at"),
    supabase.from("project_members").select("profile_id").eq("project_id", teaser.id).eq("status", "active"),
    supabase.from("backlog_progress").select("item_id, status").eq("project_id", teaser.id),
  ]);
  const progressOf = new Map((progress ?? []).map((p: { item_id: string; status: "in_progress" | "done" }) => [p.item_id, p.status]));
  // Owners see the whole lineage. Someone with access sees the public lineage plus the events of their own request.
  const seen = new Set<string>();
  const events: LineageEvent[] = [
    ...((ownEvents ?? []) as LineageEvent[]),
    ...((publicEvents ?? []) as { id: string; project_id: string; type: LineageEvent["type"]; created_at: string; team: string | null }[]).map(
      (e): LineageEvent => ({ id: e.id, project_id: e.project_id, type: e.type, actor_id: null, request_id: null, payload: e.team ? { team: e.team } : {}, created_at: e.created_at }),
    ),
  ]
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", (members ?? []).map((m: { profile_id: string }) => m.profile_id));
  const creatorNames = (profiles ?? []).map((p: { full_name: string }) => p.full_name);

  const fileList = ((files ?? []) as ProjectFile[]).filter((f) => f.storage_path);
  const fileById = new Map(fileList.map((f) => [f.id, f]));
  const backlog = (items ?? []) as DraftItem[];
  const groups: { kind: DraftItem["kind"]; title: string }[] = [
    { kind: "next_task", title: t("gNext") },
    { kind: "objective", title: t("gObjectives") },
    { kind: "completed", title: t("gCompleted") },
    { kind: "lesson", title: t("gLessons") },
  ];

  return (
    <PageShell>
      <Breadcrumb items={[{ label: t("breadcrumbDashboard"), href: "/dasbor" }, { label: teaser.title, href: `/projects/${slug}` }, { label: t("breadcrumb") }]} />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone="info">
              <Lock size={14} aria-hidden="true" /> {t("badge")}
            </Badge>
            {teaser.is_demo ? <DemoBadge /> : null}
          </div>
          <h1 className="mb-2 mt-0 text-[40px] font-medium max-sm:text-[30px]">{teaser.title}</h1>
          <p className="m-0 text-text-2">
            {owner ? t("leadOwner") : t("leadHolder")}
          </p>
        </div>
        <ButtonLink href={`/projects/${slug}`} variant="outline">
          {t("publicTeaser")}
        </ButtonLink>
      </div>

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-6">
          <Reveal>
            <Card as="section">
              <h2 className="mb-1 mt-0 text-[22px]">{t("files")}</h2>
              <p className="mb-4 mt-0 text-sm text-text-2">{t("filesIntro")}</p>
              {fileList.length === 0 ? (
                <p className="m-0 text-text-2">{t("noFiles")}</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {fileList.map((f) => {
                    const Icon = f.kind === "pdf" ? FileText : f.kind === "markdown" ? FileCode2 : FileArchive;
                    return (
                      <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-line-soft bg-white p-4">
                        <span className="flex items-center gap-2 font-code text-sm">
                          <Icon size={18} className="text-text-2" aria-hidden="true" />
                          {f.original_name}
                        </span>
                        <ButtonLink
                          href={`/api/projects/${teaser.id}/files/${f.id}/download?lang=${locale}`}
                          variant="outlineBlue"
                          size="md"
                          aria-label={t("downloadAria", { name: f.original_name })}
                          prefetch={false}
                        >
                          <Download size={16} aria-hidden="true" /> {t("download")}
                        </ButtonLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </Reveal>

          {groups.map((g) => {
            const list = backlog.filter((i) => i.kind === g.kind);
            if (list.length === 0) return null;
            return (
              <Reveal key={g.kind}>
                <Card as="section">
                  <h2 className="mb-1 mt-0 text-[22px]">{g.title}</h2>
                  {g.kind === "next_task" ? <p className="mb-4 mt-0 text-sm text-text-2">{t("progressHint")}</p> : <div className="mb-3" />}
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {list.map((it) => {
                      const ev = it.evidence[0];
                      const f = ev ? fileById.get(ev.file_id) : undefined;
                      return (
                        <li key={it.id} className="flex flex-col gap-2 rounded-[18px] border border-line-soft bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <strong>{it.title}</strong>
                            <span className="flex gap-2">
                              {it.kind === "lesson" && it.lesson_type ? <Badge tone="info">{L.lesson[it.lesson_type]}</Badge> : null}
                              {it.effort ? <Badge tone="neutral">{L.effort[it.effort]}</Badge> : null}
                              <span className="sr-only">{L.itemKind[it.kind]}</span>
                            </span>
                          </div>
                          {it.description ? <span className="text-[15px] text-text-2">{it.description}</span> : null}
                          {it.kind === "next_task" ? (
                            <ProgressControl itemId={it.id} slug={slug} title={it.title} status={progressOf.get(it.id) ?? "none"} />
                          ) : null}
                          {ev && f ? (
                            <figure className="m-0 flex flex-col gap-1.5 rounded-[14px] bg-surface p-3">
                              <blockquote className="m-0 text-sm italic text-text-3">&ldquo;{ev.quote}&rdquo;</blockquote>
                              <figcaption className="font-code text-xs text-text-2">
                                {f.original_name} · {f.kind === "markdown" ? t("section") : t("page")} {ev.page}
                              </figcaption>
                              <EvidenceChip status={it.evidence_status} />
                            </figure>
                          ) : it.origin === "creator" ? (
                            <Badge tone="info" className="self-start">
                              {t("writtenByOwners")}
                            </Badge>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </Reveal>
            );
          })}
        </div>

        <aside className="flex min-w-[280px] flex-[0_1_380px] flex-col gap-4">
          <Reveal>
            <CreditLineCard
              creditLine={creditLine({
                title: teaser.title,
                creators: creatorNames,
                lineageId: events.find((e) => e.type === "continued")?.id.slice(0, 8) ?? teaser.id.slice(0, 8),
              }, ag as unknown as TFn)}
            />
          </Reveal>
          <Reveal>
            <Card>
              <h2 className="mb-3 mt-0 text-base">{t("lineage")}</h2>
              <Lineage steps={buildFullLineage(events, tl as unknown as TFn, locale)} />
              <p className="mb-0 mt-3 text-[13px] text-text-2">{t("lineageNote")}</p>
            </Card>
          </Reveal>
          {owner ? (
            <Reveal>
              <Card tone="blue">
                <p className="m-0 text-sm text-text-3">
                  {t("ownerNote")} <Link href="/dasbor">{t("openDashboard")}</Link>
                </p>
              </Card>
            </Reveal>
          ) : null}
        </aside>
      </div>
    </PageShell>
  );
}
