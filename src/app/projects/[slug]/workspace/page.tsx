import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download, FileArchive, FileCode2, FileText, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTeaserBySlug } from "@/lib/db/public";
import { canReadPrivate, isProjectCreator } from "@/lib/db/access";
import { PageShell, Breadcrumb } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Badge, DemoBadge, EvidenceChip } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Lineage } from "@/components/features/Lineage";
import { CreditLineCard } from "@/components/features/RequestReview";
import { Reveal } from "@/components/ui/motion";
import { buildFullLineage } from "@/lib/lineage";
import { creditLine } from "@/lib/agreement/terms";
import { EFFORT_LABEL, ITEM_KIND_LABEL, LESSON_LABEL } from "@/lib/labels";
import type { DraftItem, LineageEvent, ProjectFile } from "@/lib/db/types";

export const metadata: Metadata = { title: "Workspace", robots: { index: false } };

export default async function WorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireUser(`/projects/${slug}/workspace`);
  const teaser = await getTeaserBySlug(slug);
  if (!teaser) notFound();

  // The database decides: creators and teams whose request is approved and accepted by both sides.
  if (!(await canReadPrivate(teaser.id))) redirect(`/projects/${slug}?locked=1`);
  const creator = await isProjectCreator(teaser.id);

  const supabase = await createClient();
  const [{ data: files }, { data: items }, { data: events }, { data: members }] = await Promise.all([
    supabase.from("project_files").select("*").eq("project_id", teaser.id).order("created_at"),
    supabase.from("draft_items").select("*").eq("project_id", teaser.id).eq("review_status", "kept").order("position"),
    supabase.from("lineage_events").select("*").eq("project_id", teaser.id).order("created_at"),
    supabase.from("project_members").select("profile_id, role").eq("project_id", teaser.id).eq("role", "creator"),
  ]);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", (members ?? []).map((m: { profile_id: string }) => m.profile_id));
  const creatorNames = (profiles ?? []).map((p: { full_name: string }) => p.full_name);

  const fileList = ((files ?? []) as ProjectFile[]).filter((f) => f.storage_path);
  const fileById = new Map(fileList.map((f) => [f.id, f]));
  const backlog = (items ?? []) as DraftItem[];
  const groups: { kind: DraftItem["kind"]; title: string }[] = [
    { kind: "next_task", title: "Full backlog: next tasks" },
    { kind: "objective", title: "Objectives" },
    { kind: "completed", title: "Completed work" },
    { kind: "lesson", title: "Lessons" },
  ];

  return (
    <PageShell>
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: teaser.title, href: `/projects/${slug}` }, { label: "Workspace" }]} />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone="info">
              <Lock size={14} aria-hidden="true" /> Private workspace
            </Badge>
            {teaser.is_demo ? <DemoBadge /> : null}
          </div>
          <h1 className="mb-2 mt-0 text-[40px] font-medium max-sm:text-[30px]">{teaser.title}</h1>
          <p className="m-0 text-text-2">
            {creator
              ? "You are a creator of this project. This is what an approved team sees."
              : "Your team has access because the creators approved your request and both sides accepted the agreement."}
          </p>
        </div>
        <ButtonLink href={`/projects/${slug}`} variant="outline">
          Public teaser
        </ButtonLink>
      </div>

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-6">
          <Reveal>
            <Card as="section">
              <h2 className="mb-1 mt-0 text-[22px]">Private files</h2>
              <p className="mb-4 mt-0 text-sm text-text-2">Downloads use short-lived links that are created after your access is checked.</p>
              {fileList.length === 0 ? (
                <p className="m-0 text-text-2">No files are stored for this project.</p>
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
                          href={`/api/projects/${teaser.id}/files/${f.id}/download`}
                          variant="outlineBlue"
                          size="md"
                          aria-label={`Download ${f.original_name}`}
                          prefetch={false}
                        >
                          <Download size={16} aria-hidden="true" /> Download
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
                  <h2 className="mb-4 mt-0 text-[22px]">{g.title}</h2>
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {list.map((it) => {
                      const ev = it.evidence[0];
                      const f = ev ? fileById.get(ev.file_id) : undefined;
                      return (
                        <li key={it.id} className="flex flex-col gap-2 rounded-[18px] border border-line-soft bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <strong>{it.title}</strong>
                            <span className="flex gap-2">
                              {it.kind === "lesson" && it.lesson_type ? <Badge tone="info">{LESSON_LABEL[it.lesson_type]}</Badge> : null}
                              {it.effort ? <Badge tone="neutral">{EFFORT_LABEL[it.effort]}</Badge> : null}
                              <span className="sr-only">{ITEM_KIND_LABEL[it.kind]}</span>
                            </span>
                          </div>
                          {it.description ? <span className="text-[15px] text-text-2">{it.description}</span> : null}
                          {ev && f ? (
                            <figure className="m-0 flex flex-col gap-1.5 rounded-[14px] bg-surface p-3">
                              <blockquote className="m-0 text-sm italic text-text-3">&ldquo;{ev.quote}&rdquo;</blockquote>
                              <figcaption className="font-code text-xs text-text-2">
                                {f.original_name} · {f.kind === "markdown" ? "section" : "page"} {ev.page}
                              </figcaption>
                              <EvidenceChip status={it.evidence_status} />
                            </figure>
                          ) : it.origin === "creator" ? (
                            <Badge tone="info" className="self-start">
                              Written by the creators
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
                advisor: teaser.advisor_name,
                lineageId: (events as LineageEvent[] | null)?.find((e) => e.type === "continued")?.id.slice(0, 8) ?? teaser.id.slice(0, 8),
              })}
            />
          </Reveal>
          <Reveal>
            <Card>
              <h2 className="mb-3 mt-0 text-base">Lineage</h2>
              <Lineage steps={buildFullLineage((events ?? []) as LineageEvent[])} />
              <p className="mb-0 mt-3 text-[13px] text-text-2">The lineage is append-only. Entries cannot be edited or removed.</p>
            </Card>
          </Reveal>
          {creator ? (
            <Reveal>
              <Card tone="blue">
                <p className="m-0 text-sm text-text-3">
                  Requests for this project are on your <Link href="/dashboard">dashboard</Link>.
                </p>
              </Card>
            </Reveal>
          ) : null}
        </aside>
      </div>
    </PageShell>
  );
}
