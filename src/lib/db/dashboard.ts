import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resumeStep } from "@/lib/db/owner";
import { PROJECT_STATUS_LABEL, ACCESS_MODE_LABEL, formatDate, formatMonthYear, timeAgo } from "@/lib/labels";
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

export function describeNotification(n: NotificationRow): { text: string; detail: string; href: string } {
  const p = n.payload as Record<string, string | undefined>;
  const title = p.title ?? "your project";
  switch (n.type) {
    case "new_request":
      return { text: `${p.team ?? "A team"} asked to continue ${title}.`, detail: "Read their plan and decide.", href: `/requests/${p.request_id}` };
    case "request_decision":
      return {
        text: `Your request for ${title} was ${p.decision === "approved" ? "approved" : "declined"}.`,
        detail: p.decision === "approved" ? "Accept the agreement to get access to the files." : p.note ? `Message: “${p.note}”` : "The project stays published.",
        href: `/requests/${p.request_id}`,
      };
    case "request_question":
      return { text: `The owners of ${title} asked you a question.`, detail: `“${p.message ?? ""}”`, href: `/requests/${p.request_id}` };
    case "request_expired":
      return {
        text: `The request from ${p.team ?? "a team"} for ${title} expired without a decision.`,
        detail: "You can send a new request if you still want to continue it.",
        href: `/requests/${p.request_id}`,
      };
    case "agreement_accepted":
      return {
        text: `${p.name ?? "Someone"} accepted the attribution agreement for ${title}.`,
        detail: "They now have access to the private files.",
        href: `/requests/${p.request_id}`,
      };
    case "access_taken":
      return {
        text: `${p.name ?? "Someone"} took access to ${title}.`,
        detail: "The project is open with an agreement, so no approval was needed. You can revoke access with a reason.",
        href: "/dasbor",
      };
    case "access_revoked":
      return {
        text: `Your access to ${title} was revoked by the owners.`,
        detail: `Reason: “${p.reason ?? ""}”. The attribution duty for what you already used still applies.`,
        href: "/dasbor",
      };
    case "files_unlocked":
      return { text: `Files are available for ${title}.`, detail: "Open the workspace.", href: `/requests/${p.request_id}` };
    case "advisor_decision":
      return {
        text:
          p.decision === "approved"
            ? `Your advisor approved ${title}.`
            : p.decision === "withdrawn"
              ? `Your advisor withdrew approval for ${title}.`
              : `Your advisor said “Not now” for ${title}.`,
        detail: p.comment ? `Comment: “${p.comment}”` : p.decision === "approved" ? "Review your draft and publish." : "Create a new consent link when you are ready.",
        href: `/share/${p.project_id}/consent`,
      };
    case "moderation":
      return {
        text: `${title} was ${p.action === "restored" ? "restored" : p.action === "removed" ? "removed from public view" : "hidden from public view"} by the ESTAFET team.`,
        detail: `Reason: “${p.reason ?? ""}”. Your data and any signed agreement are unchanged.`,
        href: "/dasbor",
      };
    case "break_glass":
      return {
        text: `An admin opened a private file of ${title} for an emergency review.`,
        detail: `File: ${p.file ?? "a file"}. Reason: “${p.reason ?? ""}”. This access is logged and expires after 5 minutes.`,
        href: "/dasbor",
      };
    case "team_invite":
      return { text: `You were invited to co-own ${title}.`, detail: "Accept or decline on your dashboard.", href: "/dasbor#undangan" };
    case "co_owner_joined":
      return { text: `A new co-owner joined ${title}.`, detail: "They need to confirm sharing before you can publish.", href: `/share/${p.project_id}/consent` };
    default:
      return { text: "You have a new notification.", detail: "", href: "/dasbor" };
  }
}

export async function loadDashboard(userId: string, email: string): Promise<DashboardData> {
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
    const base = { id: p.id, title: p.title, slug: p.slug, isDemo: p.is_demo, status: p.status, statusLabel: PROJECT_STATUS_LABEL[p.status] };

    if (p.moderation_status && p.moderation_status !== "ok") {
      return {
        ...base,
        meta: `${PROJECT_STATUS_LABEL[p.status]} · ${p.moderation_status === "removed" ? "removed" : "hidden"} by moderation`,
        cta: "See notifications", href: "/dasbor#notifikasi", ctaTone: "outline" as const,
        note: `The ESTAFET team ${p.moderation_status === "removed" ? "removed" : "hid"} this project from public view. Reason: ${p.moderation_reason ?? "not given"}. Your data is kept.`,
        noteTone: "warn" as const,
      };
    }
    if (p.status === "archived") {
      return {
        ...base,
        meta: `Archived · ${accessByProject.get(p.id) ?? 0} access holder(s) keep access`,
        cta: "View teaser", href: `/projects/${p.slug}`, ctaTone: "outline" as const,
        note: "This project is archived and read-only. People who already have access keep it.", noteTone: "grey" as const,
      };
    }
    if (pendingReq.length > 0) {
      return {
        ...base,
        meta: `${PROJECT_STATUS_LABEL[p.status]} ${formatMonthYear(p.published_at)} · ${pendingReq.length} new request${pendingReq.length > 1 ? "s" : ""}`,
        cta: "Review request", href: `/requests/${pendingReq[0].id}`, ctaTone: "lime" as const,
        note: "A team asked to continue this project. Read their plan and decide.", noteTone: "warn" as const,
      };
    }
    if (approvedReq.length > 0) {
      return {
        ...base,
        meta: `Published ${formatMonthYear(p.published_at)} · request approved`,
        cta: "Open request", href: `/requests/${approvedReq[0].id}`, ctaTone: "outline" as const,
        note: "You approved a request. Access starts when the team accepts the attribution agreement.", noteTone: "blue" as const,
      };
    }
    if (p.status === "published" || p.status === "unpublished") {
      const holders = accessByProject.get(p.id) ?? 0;
      const limit = p.max_active_adopters === null ? "no limit on teams" : `up to ${p.max_active_adopters} teams`;
      return {
        ...base,
        meta: `${PROJECT_STATUS_LABEL[p.status]} ${formatMonthYear(p.published_at)} · ${ACCESS_MODE_LABEL[p.access_mode]}`,
        cta: p.status === "unpublished" ? "Review and publish again" : holders > 0 ? "Open workspace" : "View teaser",
        href: p.status === "unpublished" ? `/share/${p.id}/publish` : holders > 0 ? `/projects/${p.slug}/workspace` : `/projects/${p.slug}`,
        ctaTone: "outline" as const,
        note:
          p.status === "unpublished"
            ? "The teaser is hidden from public pages. People who already have access keep it."
            : holders > 0
              ? `${holders} ${holders > 1 ? "people hold" : "person holds"} access (${limit} allowed). The lineage is recorded.`
              : "Live on Explore. You will be notified when a team asks to continue, or takes access.",
        noteTone: "grey" as const,
      };
    }
    const hasFiles = (fileCount.get(p.id) ?? 0) > 0;
    const step = resumeStep(p, hasFiles, its.length > 0);
    const joinedLate = myConsent === null && p.created_by !== userId;
    const note = joinedLate
      ? "You joined this team. Confirm that you agree to share it."
      : its.length > 0
        ? `${reviewed} of ${its.length} drafted items reviewed. Publishing unlocks when all are reviewed.`
        : hasFiles
          ? "Files are uploaded. Draft the summary and tasks, then review them."
          : "Finish the steps to publish your teaser.";
    return {
      ...base,
      meta: `Draft saved ${timeAgo(p.updated_at)}`,
      cta: "Continue", href: `/share/${p.id}/${joinedLate ? "consent" : step}`, ctaTone: "blue" as const,
      note, noteTone: "blue" as const,
    };
  });

  const toReq = (r: ContinuationRequest): DashboardRequest => {
    const t = titleById.get(r.project_id);
    return {
      id: r.id,
      projectTitle: t?.title ?? "Project",
      projectSlug: t?.slug ?? "",
      team: r.adopter_team_name,
      meta: `Sent ${timeAgo(r.created_at)}${r.decided_at ? ` · decided ${formatDate(r.decided_at)}` : ""}${r.status === "pending" && r.expires_at ? ` · expires ${formatDate(r.expires_at)}` : ""}`,
      status: r.status,
      unlocked: activeAccessByRequest.has(r.id),
      needsAgreement: r.status === "approved" && !myAcceptedRequests.has(r.id),
    };
  };
  const lower = email.toLowerCase();
  const sent = requests.filter((r) => r.created_by === userId || r.members.some((m) => m.email.toLowerCase() === lower)).map(toReq);
  const incoming = requests.filter((r) => projectIds.includes(r.project_id)).map(toReq);

  const access: DashboardAccess[] = myAccess.map((a) => {
    const t = titleById.get(a.project_id);
    return {
      id: a.id,
      projectTitle: t?.title ?? "Project",
      projectSlug: t?.slug ?? "",
      meta: a.status === "active" ? `Access since ${formatDate(a.accepted_at)} · ${a.source === "open" ? "taken directly" : "approved request"}` : `Revoked ${formatDate(a.revoked_at)}`,
      active: a.status === "active",
      revokedReason: a.revoked_reason,
    };
  });

  const notifications = ((notifRows ?? []) as NotificationRow[]).map((n) => ({
    id: n.id,
    ...describeNotification(n),
    unread: !n.read_at,
    when: timeAgo(n.created_at),
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
