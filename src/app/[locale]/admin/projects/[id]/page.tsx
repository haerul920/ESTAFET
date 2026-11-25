import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BreakGlassPanel } from "@/components/admin/BreakGlassPanel";
import { ReasonAction } from "@/components/admin/ReasonDialog";
import { KeyValueList, PageHeader, Panel, StatusPill, Time, Timeline, toneFor } from "@/components/admin/ui";
import { DemoBadge } from "@/components/ui/Badge";
import { setProjectModeration } from "@/app/[locale]/admin/actions";
import { formatWita, type AdminLocale } from "@/lib/admin/time";
import { statusText, type StatusTranslator } from "@/lib/admin/labels";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.project" });
  return { title: t("title") };
}

interface Detail {
  project: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    kind: string;
    kind_other?: string | null;
    field: string;
    year: number;
    status: string;
    moderation_status: string;
    moderation_reason: string | null;
    moderated_at: string | null;
    is_demo: boolean;
    published_at: string | null;
    created_at: string;
    stopped_note: string;
    tech: string[];
  };
  creators: { id: string; name: string }[];
  items: { id: string; kind: string; title: string; objective_status: string | null }[];
  evidence: { matched: number; partial: number; not_found: number };
  files: {
    id: string;
    name: string;
    kind: string;
    size_bytes: number;
    page_count: number | null;
    skipped: number;
    status: string;
    stored: boolean;
  }[];
  requests: { id: string; team: string; status: string; created_at: string }[];
  lineage: { id: string; type: string; created_at: string }[];
  audit: { id: string; action: string; reason: string | null; created_at: string; actor_name: string }[];
}

export default async function AdminProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [locale, t, ts, tk, tl] = await Promise.all([
    getLocale(),
    getTranslations("admin.project"),
    getTranslations("admin.status"),
    getTranslations("admin.kinds"),
    getTranslations("lineage.events"),
  ]);
  const status = (k: string) => statusText(ts as unknown as StatusTranslator, k);
  const kindName = (k: string) =>
    (tk as unknown as StatusTranslator).has(k) ? tk(k as never) : k.replaceAll("_", " ");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_project_detail", { p_id: id });
  if (error || !data) notFound();
  const d = data as Detail;
  const p = d.project;
  const mod = p.moderation_status;
  const wita = (iso: string) => formatWita(iso, locale as AdminLocale);

  return (
    <>
      <PageHeader
        title={p.title}
        intro={`${p.kind === "other" && p.kind_other ? p.kind_other : kindName(p.kind)} · ${p.year} · ${p.field}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {p.is_demo ? <DemoBadge /> : null}
            <StatusPill tone={toneFor(p.status)}>{status(p.status)}</StatusPill>
            <StatusPill tone={toneFor(mod)}>{t("moderationPill", { status: status(mod) })}</StatusPill>
          </div>
        }
      />
      <p className="mt-0 text-sm">
        <Link href="/admin/projects">{t("allProjects")}</Link>
        {mod === "ok" && p.status === "published" ? (
          <>
            {" "}
            · <Link href={`/projects/${p.slug}`}>{t("viewTeaser")}</Link>
          </>
        ) : null}
      </p>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title={t("metadata")}>
            <KeyValueList
              items={[
                { label: t("slug"), value: <code className="font-code">{p.slug}</code> },
                { label: t("owners"), value: d.creators.map((c) => c.name).join(", ") || "—" },
                { label: t("published"), value: p.published_at ? wita(p.published_at) : t("notPublished") },
                { label: t("created"), value: wita(p.created_at) },
                { label: t("builtWith"), value: p.tech.join(", ") || "—" },
                ...(p.moderation_reason ? [{ label: t("moderationReason"), value: p.moderation_reason }] : []),
              ]}
            />
          </Panel>

          <Panel title={t("teaserPreview")}>
            <p className="mt-0 text-[15px]">{p.summary}</p>
            {p.stopped_note ? (
              <p className="text-sm text-text-2">{t("whereStopped", { note: p.stopped_note })}</p>
            ) : null}
            {d.items.length === 0 ? (
              <p className="m-0 text-sm text-text-2">{t("noItems")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
                {d.items.map((i) => (
                  <li key={i.id} className="flex gap-2">
                    <StatusPill tone="info">{status(i.kind)}</StatusPill>
                    <span>{i.title}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mb-0 mt-3 text-[13px] text-text-2">{t("titlesOnly")}</p>
          </Panel>

          <Panel title={t("evidenceTitle")}>
            <div className="flex flex-wrap gap-2 text-sm">
              <StatusPill tone="ok">{t("evMatched", { count: d.evidence.matched })}</StatusPill>
              <StatusPill tone="warn">{t("evPartial", { count: d.evidence.partial })}</StatusPill>
              <StatusPill tone="danger">{t("evNotFound", { count: d.evidence.not_found })}</StatusPill>
            </div>
          </Panel>

          <Panel title={t("filesTitle")}>
            {d.files.length === 0 ? (
              <p className="m-0 text-sm text-text-2">{t("noFiles")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-text-2">
                      <th className="py-1 pr-3 font-semibold">{t("fileName")}</th>
                      <th className="pr-3 font-semibold">{t("fileType")}</th>
                      <th className="pr-3 font-semibold">{t("fileSize")}</th>
                      <th className="font-semibold">{t("fileSkipped")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.files.map((f) => (
                      <tr key={f.id} className="border-t border-line">
                        <td className="py-1.5 pr-3 font-code text-[13px]">{f.name}</td>
                        <td className="pr-3">{f.kind}</td>
                        <td className="whitespace-nowrap pr-3">{Math.max(1, Math.round(f.size_bytes / 1024))} KB</td>
                        <td>{f.skipped}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title={t("requests")}>
            {d.requests.length === 0 ? (
              <p className="m-0 text-sm text-text-2">{t("noRequests")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
                {d.requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span>{r.team}</span>
                    <span className="flex items-center gap-2">
                      <StatusPill tone={toneFor(r.status)}>{status(r.status)}</StatusPill>
                      <Time iso={r.created_at} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title={t("moderation")}>
            {/* Two decisions only: remove, or restore. Nothing happens to a project without one of them. */}
            <div className="flex flex-wrap gap-2">
              {mod !== "ok" ? (
                <ReasonAction
                  label={t("restore")}
                  tone="primary"
                  consequence={t("restoreEffect")}
                  action={setProjectModeration.bind(null, id, "ok")}
                  successMessage={t("restored")}
                />
              ) : null}
              {mod !== "removed" ? (
                <ReasonAction
                  label={t("remove")}
                  tone="danger"
                  consequence={t("removeEffect")}
                  action={setProjectModeration.bind(null, id, "removed")}
                  successMessage={t("removed")}
                />
              ) : null}
            </div>
          </Panel>

          <Panel title={t("lineage")}>
            <Timeline
              items={d.lineage.map((e) => ({
                id: e.id,
                title: (tl as unknown as StatusTranslator).has(e.type)
                  ? tl(e.type as never)
                  : e.type.replace(/_/g, " "),
                when: e.created_at,
              }))}
            />
          </Panel>

          <Panel title={t("auditHistory")}>
            <Timeline
              items={d.audit.map((a) => ({
                id: a.id,
                title: a.action,
                sub: `${a.actor_name}${a.reason ? `: “${a.reason}”` : ""}`,
                when: a.created_at,
              }))}
            />
          </Panel>

          <BreakGlassPanel projectId={id} files={d.files} />
        </div>
      </div>
    </>
  );
}
