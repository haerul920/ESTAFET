import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/guard";
import { SuspendControl } from "@/components/admin/SuspendControl";
import { ReasonAction } from "@/components/admin/ReasonDialog";
import { emailConfirmed } from "@/lib/admin/auth-users";
import { forceSignOut, resendUserVerification } from "@/app/[locale]/admin/actions";
import { KeyValueList, PageHeader, Panel, StatusPill, Time, Timeline, toneFor } from "@/components/admin/ui";
import { formatWita, type AdminLocale } from "@/lib/admin/time";
import { statusText, type StatusTranslator } from "@/lib/admin/labels";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.user" });
  return { title: t("title") };
}

interface Detail {
  profile: {
    id: string;
    full_name: string;
    email: string;
    university: string;
    faculty: string | null;
    study_program: string | null;
    is_admin: boolean;
    suspended: boolean;
    suspended_at: string | null;
    suspended_reason: string | null;
    suspended_until: string | null;
    last_sign_in_at: string | null;
    created_at: string;
  };
  projects: { id: string; title: string; status: string; moderation_status: string }[];
  requests: { id: string; team: string; status: string; project: string }[];
  audit: { id: string; action: string; reason: string | null; created_at: string }[];
}

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireAdmin();
  const [locale, t, ts] = await Promise.all([
    getLocale(),
    getTranslations("admin.user"),
    getTranslations("admin.status"),
  ]);
  const status = (k: string) => statusText(ts as unknown as StatusTranslator, k);
  const wita = (iso: string) => formatWita(iso, locale as AdminLocale);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_user_detail", { p_id: id });
  if (error || !data) notFound();
  const d = data as Detail;
  const p = d.profile;

  // Verification state comes from the sign-in service (the profile table does not hold it). Report counts: admins can read reports.
  const verified = await emailConfirmed(id);
  const projectIds = d.projects.map((x) => x.id);
  const [made, received] = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("reporter_id", id),
    projectIds.length
      ? supabase.from("reports").select("id", { count: "exact", head: true }).in("project_id", projectIds)
      : Promise.resolve({ count: 0 }),
  ]);

  return (
    <>
      <PageHeader
        title={p.full_name}
        intro={p.email}
        actions={
          <div className="flex gap-2">
            {p.is_admin ? <StatusPill tone="info">{status("admin")}</StatusPill> : null}
            {p.suspended ? (
              <StatusPill tone="danger">{status("suspended")}</StatusPill>
            ) : (
              <StatusPill tone="ok">{status("active")}</StatusPill>
            )}
          </div>
        }
      />
      <p className="mt-0 text-sm">
        <Link href="/admin/users">{t("allUsers")}</Link>
      </p>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title={t("profile")}>
            <KeyValueList
              items={[
                { label: t("university"), value: p.university },
                { label: t("faculty"), value: p.faculty || "—" },
                { label: t("studyProgram"), value: p.study_program || "—" },
                {
                  label: t("email"),
                  value: verified ? (
                    <StatusPill tone="ok">{status("confirmed")}</StatusPill>
                  ) : (
                    <StatusPill tone="warn">{status("not_confirmed")}</StatusPill>
                  ),
                },
                { label: t("reportsMade"), value: made.count ?? 0 },
                { label: t("reportsReceived"), value: received.count ?? 0 },
                { label: t("joined"), value: wita(p.created_at) },
                { label: t("lastSignIn"), value: p.last_sign_in_at ? wita(p.last_sign_in_at) : t("never") },
                ...(p.suspended
                  ? [
                      {
                        label: t("suspendedLabel"),
                        value: `${p.suspended_reason ?? ""}${p.suspended_until ? ` (${t("until", { date: wita(p.suspended_until) })})` : ""}`,
                      },
                    ]
                  : []),
              ]}
            />
          </Panel>
          <Panel title={t("projects")}>
            {d.projects.length === 0 ? (
              <p className="m-0 text-sm text-text-2">{t("none")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
                {d.projects.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/projects/${x.id}`}>{x.title}</Link>
                    <span className="flex gap-1.5">
                      <StatusPill tone={toneFor(x.status)}>{status(x.status)}</StatusPill>
                      {x.moderation_status !== "ok" ? (
                        <StatusPill tone="danger">{status(x.moderation_status)}</StatusPill>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={t("requestsSent")}>
            {d.requests.length === 0 ? (
              <p className="m-0 text-sm text-text-2">{t("none")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
                {d.requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span>
                      {r.team} → {r.project}
                    </span>
                    <StatusPill tone={toneFor(r.status)}>{status(r.status)}</StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title={t("accountActions")}>
            <SuspendControl userId={p.id} suspended={p.suspended} self={p.id === me.id} isAdmin={p.is_admin} />
            {p.id === me.id ? null : (
              <div className="mt-3 flex flex-wrap gap-2">
                <ReasonAction
                  small
                  label={t("forceSignOut")}
                  consequence={t("signOutEffect")}
                  reasonLabel={t("signOutReason")}
                  action={forceSignOut.bind(null, p.id)}
                  successMessage={t("sessionsEnded")}
                />
                {verified ? null : (
                  <ReasonAction
                    small
                    label={t("resend")}
                    consequence={t("resendEffect")}
                    reasonLabel={t("resendReason")}
                    action={resendUserVerification.bind(null, p.id)}
                    successMessage={t("resent")}
                  />
                )}
              </div>
            )}
          </Panel>
          <Panel title={t("activity")}>
            <Timeline
              items={d.audit.map((a) => ({
                id: a.id,
                title: a.action,
                sub: a.reason ? `“${a.reason}”` : undefined,
                when: a.created_at,
              }))}
            />
          </Panel>
        </div>
      </div>
      <span className="sr-only">
        <Time iso={p.created_at} />
      </span>
    </>
  );
}
