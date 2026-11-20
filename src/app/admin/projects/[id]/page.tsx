import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BreakGlassPanel } from "@/components/admin/BreakGlassPanel";
import { ReasonAction } from "@/components/admin/ReasonDialog";
import { KeyValueList, PageHeader, Panel, StatusPill, Time, Timeline, toneFor } from "@/components/admin/ui";
import { DemoBadge } from "@/components/ui/Badge";
import { setProjectModeration } from "@/app/admin/actions";
import { KIND_LABEL } from "@/lib/labels";
import { formatWita } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Project" };

interface Detail {
  project: { id: string; slug: string; title: string; summary: string; kind: keyof typeof KIND_LABEL; field: string; year: number; status: string; moderation_status: string; moderation_reason: string | null; moderated_at: string | null; is_demo: boolean; advisor_name: string; published_at: string | null; created_at: string; stopped_note: string; tech: string[] };
  creators: { id: string; name: string }[];
  items: { id: string; kind: string; title: string; effort: string | null; objective_status: string | null }[];
  evidence: { matched: number; partial: number; not_found: number };
  files: { id: string; name: string; kind: string; size_bytes: number; page_count: number | null; skipped: number; status: string; stored: boolean }[];
  requests: { id: string; team: string; status: string; created_at: string }[];
  consent: { status: string; expires_at: string; decided_at: string | null } | null;
  lineage: { id: string; type: string; created_at: string }[];
  audit: { id: string; action: string; reason: string | null; created_at: string; actor_name: string }[];
}

export default async function AdminProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_project_detail", { p_id: id });
  if (error || !data) notFound();
  const d = data as Detail;
  const p = d.project;
  const mod = p.moderation_status;

  return (
    <>
      <PageHeader
        title={p.title}
        intro={`${KIND_LABEL[p.kind]} · ${p.year} · ${p.field}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {p.is_demo ? <DemoBadge /> : null}
            <StatusPill tone={toneFor(p.status)}>{p.status.replace("_", " ")}</StatusPill>
            <StatusPill tone={toneFor(mod)}>moderation: {mod}</StatusPill>
          </div>
        }
      />
      <p className="mt-0 text-sm">
        <Link href="/admin/projects">All projects</Link>
        {mod === "ok" && ["published", "adopted"].includes(p.status) ? <> · <Link href={`/projects/${p.slug}`}>View public teaser</Link></> : null}
      </p>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Metadata">
            <KeyValueList
              items={[
                { label: "Slug", value: <code className="font-code">{p.slug}</code> },
                { label: "Creators", value: d.creators.map((c) => c.name).join(", ") || "—" },
                { label: "Advisor", value: p.advisor_name || "—" },
                { label: "Published", value: p.published_at ? formatWita(p.published_at) : "Not published" },
                { label: "Created", value: formatWita(p.created_at) },
                { label: "Built with", value: p.tech.join(", ") || "—" },
                ...(p.moderation_reason ? [{ label: "Moderation reason", value: p.moderation_reason }] : []),
              ]}
            />
          </Panel>

          <Panel title="Public teaser preview">
            <p className="mt-0 text-[15px]">{p.summary}</p>
            {p.stopped_note ? <p className="text-sm text-text-2">Where it stopped: {p.stopped_note}</p> : null}
            {d.items.length === 0 ? <p className="m-0 text-sm text-text-2">No kept items yet.</p> : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
                {d.items.map((i) => (
                  <li key={i.id} className="flex gap-2"><StatusPill tone="info">{i.kind.replace("_", " ")}</StatusPill><span>{i.title}</span></li>
                ))}
              </ul>
            )}
            <p className="mb-0 mt-3 text-[13px] text-text-2">Titles only. Evidence quotes from private files are never shown here.</p>
          </Panel>

          <Panel title="Evidence status (counts only)">
            <div className="flex flex-wrap gap-2 text-sm">
              <StatusPill tone="ok">matched {d.evidence.matched}</StatusPill>
              <StatusPill tone="warn">partial {d.evidence.partial}</StatusPill>
              <StatusPill tone="danger">not found {d.evidence.not_found}</StatusPill>
            </div>
          </Panel>

          <Panel title="Files (metadata only)">
            {d.files.length === 0 ? <p className="m-0 text-sm text-text-2">No files.</p> : (
              <table className="w-full text-left text-sm">
                <thead><tr className="text-text-2"><th className="py-1 font-semibold">Name</th><th className="font-semibold">Type</th><th className="font-semibold">Size</th><th className="font-semibold">Skipped sensitive</th></tr></thead>
                <tbody>
                  {d.files.map((f) => (
                    <tr key={f.id} className="border-t border-line"><td className="py-1.5 font-code text-[13px]">{f.name}</td><td>{f.kind}</td><td>{Math.max(1, Math.round(f.size_bytes / 1024))} KB</td><td>{f.skipped}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Requests">
            {d.requests.length === 0 ? <p className="m-0 text-sm text-text-2">No requests.</p> : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
                {d.requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2"><span>{r.team}</span><span className="flex items-center gap-2"><StatusPill tone={toneFor(r.status)}>{r.status}</StatusPill><Time iso={r.created_at} /></span></li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Moderation">
            <div className="flex flex-wrap gap-2">
              {mod === "ok" ? (
                <>
                  <ReasonAction
                    label="Hide"
                    consequence={<>The project disappears from Explore, search and its public page (404). Nothing is deleted. The creators are told your reason.</>}
                    action={setProjectModeration.bind(null, id, "hidden")}
                    undo={{ action: setProjectModeration.bind(null, id, "ok") }}
                    successMessage="Project hidden."
                  />
                  <ReasonAction
                    label="Remove"
                    tone="danger"
                    consequence={<>The project is taken down like Hide, and marked as removed. Data and any signed agreement stay. Needs a recent password check. You can restore it later.</>}
                    action={setProjectModeration.bind(null, id, "removed")}
                    successMessage="Project removed."
                  />
                </>
              ) : (
                <ReasonAction
                  label="Restore"
                  tone="primary"
                  consequence={<>The project becomes visible again if its status is published or adopted. The creators are told.</>}
                  action={setProjectModeration.bind(null, id, "ok")}
                  undo={mod === "hidden" ? { action: setProjectModeration.bind(null, id, "hidden") } : undefined}
                  successMessage="Project restored."
                />
              )}
            </div>
          </Panel>

          <Panel title="Advisor consent">
            {d.consent ? (
              <KeyValueList items={[{ label: "Status", value: <StatusPill tone={toneFor(d.consent.status)}>{d.consent.status}</StatusPill> }, { label: "Expires", value: formatWita(d.consent.expires_at) }, { label: "Decided", value: d.consent.decided_at ? formatWita(d.consent.decided_at) : "—" }]} />
            ) : <p className="m-0 text-sm text-text-2">No consent requested yet.</p>}
          </Panel>

          <Panel title="Lifecycle (lineage)">
            <Timeline items={d.lineage.map((e) => ({ id: e.id, title: e.type.replace(/_/g, " "), when: e.created_at }))} />
          </Panel>

          <Panel title="Audit history for this project">
            <Timeline items={d.audit.map((a) => ({ id: a.id, title: a.action, sub: `${a.actor_name}${a.reason ? `: “${a.reason}”` : ""}`, when: a.created_at }))} />
          </Panel>

          <BreakGlassPanel projectId={id} files={d.files} />
        </div>
      </div>
    </>
  );
}
