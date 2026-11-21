import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/guard";
import { SuspendControl } from "@/components/admin/SuspendControl";
import { KeyValueList, PageHeader, Panel, StatusPill, Time, Timeline, toneFor } from "@/components/admin/ui";
import { formatWita } from "@/lib/admin/time";

export const metadata: Metadata = { title: "User" };

interface Detail {
  profile: { id: string; full_name: string; email: string; university: string; faculty: string | null; study_program: string | null; is_admin: boolean; suspended: boolean; suspended_at: string | null; suspended_reason: string | null; suspended_until: string | null; last_sign_in_at: string | null; created_at: string };
  projects: { id: string; title: string; status: string; moderation_status: string }[];
  requests: { id: string; team: string; status: string; project: string }[];
  audit: { id: string; action: string; reason: string | null; created_at: string }[];
}

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_user_detail", { p_id: id });
  if (error || !data) notFound();
  const d = data as Detail;
  const p = d.profile;

  return (
    <>
      <PageHeader
        title={p.full_name}
        intro={p.email}
        actions={<div className="flex gap-2">{p.is_admin ? <StatusPill tone="info">admin</StatusPill> : null}{p.suspended ? <StatusPill tone="danger">suspended</StatusPill> : <StatusPill tone="ok">active</StatusPill>}</div>}
      />
      <p className="mt-0 text-sm"><Link href="/admin/users">All users</Link></p>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Profile">
            <KeyValueList items={[
              { label: "University", value: p.university },
              { label: "Faculty", value: p.faculty || "—" },
              { label: "Study program", value: p.study_program || "—" },
              { label: "Joined", value: formatWita(p.created_at) },
              { label: "Last sign-in", value: p.last_sign_in_at ? formatWita(p.last_sign_in_at) : "never" },
              ...(p.suspended ? [{ label: "Suspended", value: `${p.suspended_reason ?? ""}${p.suspended_until ? ` (until ${formatWita(p.suspended_until)})` : ""}` }] : []),
            ]} />
          </Panel>
          <Panel title="Projects">
            {d.projects.length === 0 ? <p className="m-0 text-sm text-text-2">None.</p> : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
                {d.projects.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-2"><Link href={`/admin/projects/${x.id}`}>{x.title}</Link><span className="flex gap-1.5"><StatusPill tone={toneFor(x.status)}>{x.status.replace("_", " ")}</StatusPill>{x.moderation_status !== "ok" ? <StatusPill tone="danger">{x.moderation_status}</StatusPill> : null}</span></li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Requests sent">
            {d.requests.length === 0 ? <p className="m-0 text-sm text-text-2">None.</p> : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
                {d.requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2"><span>{r.team} → {r.project}</span><StatusPill tone={toneFor(r.status)}>{r.status}</StatusPill></li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Account actions">
            <SuspendControl userId={p.id} suspended={p.suspended} self={p.id === me.id} isAdmin={p.is_admin} />
          </Panel>
          <Panel title="Activity from the audit log">
            <Timeline items={d.audit.map((a) => ({ id: a.id, title: a.action, sub: a.reason ? `“${a.reason}”` : undefined, when: a.created_at }))} />
          </Panel>
        </div>
      </div>
      <span className="sr-only"><Time iso={p.created_at} /></span>
    </>
  );
}
