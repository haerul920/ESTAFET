import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resumeStep } from "@/lib/db/owner";
import { formatDate, formatMonthYear, timeAgo } from "@/lib/format";
import type { Labels, TFn } from "@/lib/labels";
import type { ContinuationRequest, NotificationRow, Project, ProjectAccess, ProjectStatus, RequestStatus } from "./types";

export interface DashboardProject {
  id: string;
  title: string;
  slug: string;
  meta: string;
  status: ProjectStatus;
  statusLabel: string;
  cta: string;
  href: string;
  ctaTone: "lime" | "blue" | "outline";
  note: string;
  noteTone: "warn" | "blue" | "grey";
  isDemo: boolean;
}

export interface DashboardRequest {
  id: string;
  projectTitle: string;
  projectSlug: string;
  team: string;
  meta: string;
  status: RequestStatus;
  /** Somebody from this request holds active access. */
  unlocked: boolean;
  /** The request was approved and the signed-in user has not accepted the agreement yet. */
  needsAgreement: boolean;
}

/** Access the signed-in user holds on somebody else's project. */
export interface DashboardAccess {
  id: string;
  projectTitle: string;
  projectSlug: string;
  meta: string;
  active: boolean;
  revokedReason: string | null;
}

export interface DashboardInvitation {
  projectId: string;
  title: string;
}

export interface DashboardNotification {
  id: string;
  text: string;
  detail: string;
  href: string;
  unread: boolean;
  when: string;
}

export interface DashboardData {
  /** "Proyek saya": projects I share (as owner or co-owner). */
  mine: DashboardProject[];
  /** Requests other people sent to my projects. */
  incoming: DashboardRequest[];
  invitations: DashboardInvitation[];
  /** "Proyek yang saya lanjutkan": access I hold and requests I sent. */
  access: DashboardAccess[];
  sent: DashboardRequest[];
  notifications: DashboardNotification[];
  tiles: { decisions: number; drafts: number; sentPending: number };
  hasDemo: boolean;
}

/** `t` is the translator for the `dashboard` namespace. */
export function describeNotification(n: NotificationRow, t: TFn): { text: string; detail: string; href: string } {
  const p = n.payload as Record<string, string | undefined>;
  const title = p.title ?? t("n.titleDefault");
  switch (n.type) {
    case "new_request":
      return { text: t("n.newRequest.text", { team: p.team ?? t("n.teamDefault"), title }), detail: t("n.newRequest.detail"), href: `/requests/${p.request_id}` };
    case "request_decision":
      return {
        text: t(p.decision === "approved" ? "n.decision.approved" : "n.decision.declined", { title }),
        detail: p.decision === "approved" ? t("n.decision.detailApproved") : p.note ? t("n.decision.detailNote", { note: p.note }) : t("n.decision.detailDeclined"),
        href: `/requests/${p.request_id}`,
      };
    case "request_question":
      return { text: t("n.question.text", { title }), detail: t("n.question.detail", { message: p.message ?? "" }), href: `/requests/${p.request_id}` };
    case "request_expired":
      return { text: t("n.expired.text", { team: p.team ?? t("n.teamDefault"), title }), detail: t("n.expired.detail"), href: `/requests/${p.request_id}` };
    case "agreement_accepted":
      return { text: t("n.agreement.text", { name: p.name ?? t("n.nameDefault"), title }), detail: t("n.agreement.detail"), href: `/requests/${p.request_id}` };
    case "access_taken":
      return { text: t("n.accessTaken.text", { name: p.name ?? t("n.nameDefault"), title }), detail: t("n.accessTaken.detail"), href: "/dasbor" };
    case "access_revoked":
      return { text: t("n.accessRevoked.text", { title }), detail: t("n.accessRevoked.detail", { reason: p.reason ?? "" }), href: "/dasbor" };
    case "files_unlocked":
      return { text: t("n.filesUnlocked.text", { title }), detail: t("n.filesUnlocked.detail"), href: `/requests/${p.request_id}` };
    case "advisor_decision":
      return {
        text: t(p.decision === "approved" ? "n.advisor.approved" : p.decision === "withdrawn" ? "n.advisor.withdrawn" : "n.advisor.declined", { title }),
        detail: p.comment ? t("n.advisor.detailComment", { comment: p.comment }) : p.decision === "approved" ? t("n.advisor.detailApproved") : t("n.advisor.detailDeclined"),
        href: `/share/${p.project_id}/consent`,
      };
    case "moderation":
      return {
        text: t(p.action === "restored" ? "n.moderation.restored" : p.action === "removed" ? "n.moderation.removed" : "n.moderation.hidden", { title }),
        detail: t("n.moderation.detail", { reason: p.reason ?? "" }),
        href: "/dasbor",
      };
    case "break_glass":
      return {
        text: t("n.breakGlass.text", { title }),
        detail: t("n.breakGlass.detail", { file: p.file ?? t("n.fileDefault"), reason: p.reason ?? "" }),
        href: "/dasbor",
      };
    case "team_invite":
      return { text: t("n.invite.text", { title }), detail: t("n.invite.detail"), href: "/dasbor#undangan" };
    case "co_owner_joined":
      return { text: t("n.joined.text", { title }), detail: t("n.joined.detail"), href: `/share/${p.project_id}/consent` };
    default:
      return { text: t("n.default"), detail: "", href: "/dasbor" };
  }
}

/** `ctx.t` is the `dashboard` translator and `ctx.L` the enum labels, both in the active language. */
export async function loadDashboard(userId: string, email: string, ctx: { t: TFn; L: Labels; locale: string }): Promise<DashboardData> {
  const { t, L, locale } = ctx;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: memberRows } = await supabase
    .from("project_members")
    .select("project_id, status, consented_at")
    .eq("profile_id", userId)
    .in("status", ["active", "invited"]);
  const members = (memberRows ?? []) as { project_id: string; status: string; consented_at: string | null }[];
  const projectIds = members.filter((m) => m.status === "active").map((m) => m.project_id);
  const invitedIds = members.filter((m) => m.status === "invited").map((m) => m.project_id);
  const consentedByMe = new Map(members.map((m) => [m.project_id, m.consented_at]));

  const [{ data: projectRows }, { data: itemRows }, { data: filesRows }, { data: reqRows }, { data: accessRows }, { data: notifRows }, { data: invitedProjects }] =
    await Promise.all([
      projectIds.length ? supabase.from("projects").select("*").in("id", projectIds).order("updated_at", { ascending: false }) : Promise.resolve({ data: [] }),
      projectIds.length ? supabase.from("draft_items").select("project_id, review_status").in("project_id", projectIds) : Promise.resolve({ data: [] }),
      projectIds.length ? supabase.from("project_files").select("project_id").in("project_id", projectIds) : Promise.resolve({ data: [] }),
      supabase.from("continuation_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("project_access").select("*").eq("profile_id", userId).order("accepted_at", { ascending: false }),
      supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      // An invitee is not a member yet, so RLS hides the project. The server reads only the title, after the membership row proved the invitation.
      invitedIds.length ? admin.from("projects").select("id, title").in("id", invitedIds) : Promise.resolve({ data: [] }),
    ]);

  const projects = (projectRows ?? []) as Project[];
  const items = (itemRows ?? []) as { project_id: string; review_status: string }[];
  const fileCount = new Map<string, number>();
  for (const f of (filesRows ?? []) as { project_id: string }[]) fileCount.set(f.project_id, (fileCount.get(f.project_id) ?? 0) + 1);
  const requests = (reqRows ?? []) as ContinuationRequest[];
  const myAccess = (accessRows ?? []) as ProjectAccess[];
  const activeAccessByRequest = new Map<string, number>();
  const accessByProject = new Map<string, number>();

  // Titles for requests and access: the service role reads only title and slug, after RLS returned the rows.
  const titleIds = [...new Set([...requests.map((r) => r.project_id), ...myAccess.map((a) => a.project_id)])];
  const { data: titleRows } = titleIds.length ? await admin.from("projects").select("id, title, slug").in("id", titleIds) : { data: [] };
  const titleById = new Map((titleRows ?? []).map((t: { id: string; title: string; slug: string }) => [t.id, t]));

  // Which requests already produced access (for any person), and how many active access rows each of my projects has.
  const reqIds = requests.map((r) => r.id);
  if (reqIds.length) {
    const { data: forRequests } = await admin.from("project_access").select("request_id").in("request_id", reqIds).eq("status", "active");
    for (const a of (forRequests ?? []) as { request_id: string | null }[]) {
      if (a.request_id) activeAccessByRequest.set(a.request_id, (activeAccessByRequest.get(a.request_id) ?? 0) + 1);
    }
  }
  if (projectIds.length) {
    const { data: onMine } = await supabase.from("project_access").select("project_id").in("project_id", projectIds).eq("status", "active");
    for (const a of (onMine ?? []) as { project_id: string }[]) accessByProject.set(a.project_id, (accessByProject.get(a.project_id) ?? 0) + 1);
  }
  const myAcceptedRequests = new Set(myAccess.filter((a) => a.status === "active" && a.request_id).map((a) => a.request_id as string));

  const unsignedByProject = new Map<string, ContinuationRequest[]>();
  for (const r of requests) {
    if (!projectIds.includes(r.project_id)) continue;
    if (r.status === "pending" || (r.status === "approved" && !activeAccessByRequest.has(r.id))) {
      unsignedByProject.set(r.project_id, [...(unsignedByProject.get(r.project_id) ?? []), r]);
    }
  }

  const mine: DashboardProject[] = projects.map((p) => {
    const its = items.filter((i) => i.project_id === p.id);
    const reviewed = its.filter((i) => i.review_status !== "pending").length;
    const open = unsignedByProject.get(p.id) ?? [];
    const pendingReq = open.filter((r) => r.status === "pending");
    const approvedReq = open.filter((r) => r.status === "approved");
    const myConsent = consentedByMe.get(p.id);
    const statusLabel = L.projectStatus[p.status];
    const when = formatMonthYear(p.published_at, locale);
    const base = { id: p.id, title: p.title, slug: p.slug, isDemo: p.is_demo, status: p.status, statusLabel };

    if (p.moderation_status && p.moderation_status !== "ok") {
      return {
        ...base,
        meta: t("p.moderatedMeta", { status: statusLabel, state: p.moderation_status === "removed" ? t("p.stateRemoved") : t("p.stateHidden") }),
        cta: t("p.moderatedCta"), href: "/dasbor#notifikasi", ctaTone: "outline" as const,
        note: t("p.moderatedNote", { action: p.moderation_status === "removed" ? t("p.actionRemoved") : t("p.actionHidden"), reason: p.moderation_reason ?? t("p.reasonDefault") }),
        noteTone: "warn" as const,
      };
    }
    if (p.status === "archived") {
      return {
        ...base,
        meta: t("p.archivedMeta", { count: accessByProject.get(p.id) ?? 0 }),
        cta: t("p.archivedCta"), href: `/projects/${p.slug}`, ctaTone: "outline" as const,
        note: t("p.archivedNote"), noteTone: "grey" as const,
      };
    }
    if (pendingReq.length > 0) {
      return {
        ...base,
        meta: t("p.pendingMeta", { status: statusLabel, when, count: pendingReq.length }),
        cta: t("p.pendingCta"), href: `/requests/${pendingReq[0].id}`, ctaTone: "lime" as const,
        note: t("p.pendingNote"), noteTone: "warn" as const,
      };
    }
    if (approvedReq.length > 0) {
      return {
        ...base,
        meta: t("p.approvedMeta", { when }),
        cta: t("p.approvedCta"), href: `/requests/${approvedReq[0].id}`, ctaTone: "outline" as const,
        note: t("p.approvedNote"), noteTone: "blue" as const,
      };
    }
    if (p.status === "published" || p.status === "unpublished") {
      const holders = accessByProject.get(p.id) ?? 0;
      const limit = p.max_active_adopters === null ? t("p.limitNone") : t("p.limitN", { count: p.max_active_adopters });
      return {
        ...base,
        meta: t("p.liveMeta", { status: statusLabel, when, mode: L.accessMode[p.access_mode] }),
        cta: p.status === "unpublished" ? t("p.republishCta") : holders > 0 ? t("p.workspaceCta") : t("p.teaserCta"),
        href: p.status === "unpublished" ? `/share/${p.id}/publish` : holders > 0 ? `/projects/${p.slug}/workspace` : `/projects/${p.slug}`,
        ctaTone: "outline" as const,
        note:
          p.status === "unpublished"
            ? t("p.unpublishedNote")
            : holders > 0
              ? t("p.holdersNote", { count: holders, limit })
              : t("p.liveNote"),
        noteTone: "grey" as const,
      };
    }
    const hasFiles = (fileCount.get(p.id) ?? 0) > 0;
    const step = resumeStep(p, hasFiles, its.length > 0);
    const joinedLate = myConsent === null && p.created_by !== userId;
    const note = joinedLate
      ? t("p.joinedLate")
      : its.length > 0
        ? t("p.reviewed", { reviewed, total: its.length })
        : hasFiles
          ? t("p.filesUploaded")
          : t("p.draftDefault");
    return {
      ...base,
      meta: t("p.draftMeta", { when: timeAgo(p.updated_at, locale) }),
      cta: t("p.draftCta"), href: `/share/${p.id}/${joinedLate ? "consent" : step}`, ctaTone: "blue" as const,
      note, noteTone: "blue" as const,
    };
  });

  const toReq = (r: ContinuationRequest): DashboardRequest => {
    const ti = titleById.get(r.project_id);
    return {
      id: r.id,
      projectTitle: ti?.title ?? t("r.projectDefault"),
      projectSlug: ti?.slug ?? "",
      team: r.adopter_team_name,
      meta: `${t("r.sent", { when: timeAgo(r.created_at, locale) })}${r.decided_at ? t("r.decided", { date: formatDate(r.decided_at, locale) }) : ""}${r.status === "pending" && r.expires_at ? t("r.expires", { date: formatDate(r.expires_at, locale) }) : ""}`,
      status: r.status,
      unlocked: activeAccessByRequest.has(r.id),
      needsAgreement: r.status === "approved" && !myAcceptedRequests.has(r.id),
    };
  };
  const lower = email.toLowerCase();
  const sent = requests.filter((r) => r.created_by === userId || r.members.some((m) => m.email.toLowerCase() === lower)).map(toReq);
  const incoming = requests.filter((r) => projectIds.includes(r.project_id)).map(toReq);

  const access: DashboardAccess[] = myAccess.map((a) => {
    const ti = titleById.get(a.project_id);
    return {
      id: a.id,
      projectTitle: ti?.title ?? t("r.projectDefault"),
      projectSlug: ti?.slug ?? "",
      meta: a.status === "active" ? t("a.since", { date: formatDate(a.accepted_at, locale), source: a.source === "open" ? t("a.sourceOpen") : t("a.sourceRequest") }) : t("a.revoked", { date: formatDate(a.revoked_at, locale) }),
      active: a.status === "active",
      revokedReason: a.revoked_reason,
    };
  });

  const notifications = ((notifRows ?? []) as NotificationRow[]).map((n) => ({
    id: n.id,
    ...describeNotification(n, t),
    unread: !n.read_at,
    when: timeAgo(n.created_at, locale),
  }));

  return {
    mine,
    incoming,
    invitations: ((invitedProjects ?? []) as { id: string; title: string }[]).map((p) => ({ projectId: p.id, title: p.title })),
    access,
    sent,
    notifications,
    tiles: {
      decisions: incoming.filter((r) => r.status === "pending").length,
      drafts: mine.filter((p) => p.ctaTone === "blue").length,
      sentPending: sent.filter((r) => r.status === "pending").length,
    },
    hasDemo: mine.some((p) => p.isDemo) || sent.length > 0 || access.length > 0,
  };
}
