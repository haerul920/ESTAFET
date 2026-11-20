import "server-only";
import { createClient } from "@/lib/supabase/server";
import { resumeStep } from "@/lib/db/creator";
import { pipelineStage, PROJECT_STATUS_LABEL, formatDate, formatMonthYear, timeAgo } from "@/lib/labels";
import type { ContinuationRequest, NotificationRow, Project, RequestStatus } from "./types";

export interface DashboardProject {
  id: string;
  title: string;
  slug: string;
  meta: string;
  stage: number;
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
  unlocked: boolean;
  needsAgreement: boolean;
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
  projects: DashboardProject[];
  sent: DashboardRequest[];
  received: DashboardRequest[];
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
        detail: p.decision === "approved" ? "Accept the agreement to unlock the files." : p.note ? `Message: “${p.note}”` : "The project stays published.",
        href: `/requests/${p.request_id}`,
      };
    case "request_question":
      return { text: `The creators of ${title} asked you a question.`, detail: `“${p.message ?? ""}”`, href: `/requests/${p.request_id}` };
    case "agreement_accepted":
      return {
        text: `The ${p.side === "creator" ? "creators" : "adopter team"} accepted the agreement for ${title}.`,
        detail: "The files unlock when both sides have accepted.",
        href: `/requests/${p.request_id}`,
      };
    case "files_unlocked":
      return { text: `Files are unlocked for ${title}.`, detail: "Open the workspace.", href: `/requests/${p.request_id}` };
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
        href: "/dashboard",
      };
    case "break_glass":
      return {
        text: `An admin opened a private file of ${title} for an emergency review.`,
        detail: `File: ${p.file ?? "a file"}. Reason: “${p.reason ?? ""}”. This access is logged and expires after 5 minutes.`,
        href: "/dashboard",
      };
    case "team_invite":
      return { text: "You were added to a project team.", detail: "Confirm that you agree to share it.", href: `/share/${p.project_id}/consent` };
    default:
      return { text: "You have a new notification.", detail: "", href: "/dashboard" };
  }
}

export async function loadDashboard(userId: string, email: string): Promise<DashboardData> {
  const supabase = await createClient();

  const { data: memberRows } = await supabase
    .from("project_members")
    .select("project_id, consented_at")
    .eq("profile_id", userId)
    .eq("role", "creator");
  const projectIds = (memberRows ?? []).map((m: { project_id: string }) => m.project_id);
  const consentedByMe = new Map((memberRows ?? []).map((m: { project_id: string; consented_at: string | null }) => [m.project_id, m.consented_at]));

  const [{ data: projectRows }, { data: itemRows }, { data: filesRows }, { data: reqRows }, { data: notifRows }] = await Promise.all([
    projectIds.length ? supabase.from("projects").select("*").in("id", projectIds).order("updated_at", { ascending: false }) : Promise.resolve({ data: [] }),
    projectIds.length ? supabase.from("draft_items").select("project_id, review_status").in("project_id", projectIds) : Promise.resolve({ data: [] }),
    projectIds.length ? supabase.from("project_files").select("project_id").in("project_id", projectIds) : Promise.resolve({ data: [] }),
    supabase.from("continuation_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
  ]);

  const projects = (projectRows ?? []) as Project[];
  const items = (itemRows ?? []) as { project_id: string; review_status: string }[];
  const fileCount = new Map<string, number>();
  for (const f of (filesRows ?? []) as { project_id: string }[]) fileCount.set(f.project_id, (fileCount.get(f.project_id) ?? 0) + 1);
  const requests = (reqRows ?? []) as ContinuationRequest[];

  const titleIds = [...new Set(requests.map((r) => r.project_id))];
  const { data: teasers } = titleIds.length
    ? await supabase.from("public_project_teaser").select("id, title, slug").in("id", titleIds)
    : { data: [] };
  const teaserById = new Map((teasers ?? []).map((t: { id: string; title: string; slug: string }) => [t.id, t]));
  const unlockedSet = new Set<string>();
  await Promise.all(
    requests
      .filter((r) => r.status === "approved")
      .map(async (r) => {
        const { data } = await supabase.rpc("request_unlocked", { rid: r.id });
        if (data === true) unlockedSet.add(r.id);
      }),
  );
  const myAccepted = new Set<string>();
  if (requests.some((r) => r.status === "approved")) {
    const { data: acc } = await supabase.from("agreement_acceptances").select("request_id").eq("profile_id", userId);
    for (const a of (acc ?? []) as { request_id: string }[]) myAccepted.add(a.request_id);
  }

  const pendingByProject = new Map<string, ContinuationRequest[]>();
  for (const r of requests) {
    if (!projectIds.includes(r.project_id)) continue;
    if (r.status === "pending" || (r.status === "approved" && !unlockedSet.has(r.id))) {
      pendingByProject.set(r.project_id, [...(pendingByProject.get(r.project_id) ?? []), r]);
    }
  }

  const dashProjects: DashboardProject[] = projects.map((p) => {
    const its = items.filter((i) => i.project_id === p.id);
    const reviewed = its.filter((i) => i.review_status !== "pending").length;
    const pendingReq = (pendingByProject.get(p.id) ?? []).filter((r) => r.status === "pending");
    const approvedReq = (pendingByProject.get(p.id) ?? []).filter((r) => r.status === "approved");
    const myConsent = consentedByMe.get(p.id);
    const stage = pipelineStage(p.status);
    if (p.moderation_status && p.moderation_status !== "ok") {
      return {
        id: p.id, title: p.title, slug: p.slug, stage, isDemo: p.is_demo,
        meta: `${PROJECT_STATUS_LABEL[p.status]} · ${p.moderation_status === "removed" ? "removed" : "hidden"} by moderation`,
        cta: "See notifications", href: "/dashboard?tab=notifications", ctaTone: "outline" as const,
        note: `The ESTAFET team ${p.moderation_status === "removed" ? "removed" : "hid"} this project from public view. Reason: ${p.moderation_reason ?? "not given"}. Your data is kept.`,
        noteTone: "warn" as const,
      };
    }

    if (pendingReq.length > 0) {
      return {
        id: p.id, title: p.title, slug: p.slug, stage, isDemo: p.is_demo,
        meta: `${PROJECT_STATUS_LABEL[p.status]} ${formatMonthYear(p.published_at)} · ${pendingReq.length} new request${pendingReq.length > 1 ? "s" : ""}`,
        cta: "Review request", href: `/requests/${pendingReq[0].id}`, ctaTone: "lime",
        note: "A team asked to continue this project. Read their plan and decide.", noteTone: "warn",
      };
    }
    if (approvedReq.length > 0) {
      return {
        id: p.id, title: p.title, slug: p.slug, stage, isDemo: p.is_demo,
        meta: `Published ${formatMonthYear(p.published_at)} · request approved`,
        cta: "Accept the agreement", href: `/requests/${approvedReq[0].id}`, ctaTone: "lime",
        note: "You approved a request. Accept the attribution agreement so the files can unlock.", noteTone: "warn",
      };
    }
    if (p.status === "published" || p.status === "adopted") {
      return {
        id: p.id, title: p.title, slug: p.slug, stage, isDemo: p.is_demo,
        meta: `${PROJECT_STATUS_LABEL[p.status]} ${formatMonthYear(p.published_at)}`,
        cta: p.status === "adopted" ? "Open workspace" : "View teaser",
        href: p.status === "adopted" ? `/projects/${p.slug}/workspace` : `/projects/${p.slug}`, ctaTone: "outline",
        note: p.status === "adopted" ? "Another team is continuing this project. The lineage is recorded." : "Live on Explore. You will be notified when a team asks to continue.",
        noteTone: "grey",
      };
    }
    const step = resumeStep(p, (fileCount.get(p.id) ?? 0) > 0, its.length > 0);
    const note =
      myConsent === null && p.created_by !== userId
        ? "You were added to this team. Confirm that you agree to share it."
        : p.status === "verifying" && its.length > 0
          ? `${reviewed} of ${its.length} drafted items reviewed. Publishing unlocks when all are reviewed.`
          : p.status === "awaiting_advisor"
            ? "Waiting for your advisor. Share the private consent link with them."
            : its.length === 0 && p.status === "verifying"
              ? "Your advisor approved. Upload files to draft the summary and tasks."
              : "Finish the steps to publish your teaser.";
    return {
      id: p.id, title: p.title, slug: p.slug, stage, isDemo: p.is_demo,
      meta: `Draft saved ${timeAgo(p.updated_at)}`,
      cta: "Continue", href: `/share/${p.id}/${myConsent === null && p.created_by !== userId ? "consent" : step}`, ctaTone: "blue",
      note, noteTone: "blue",
    };
  });

  const toReq = (r: ContinuationRequest): DashboardRequest => {
    const t = teaserById.get(r.project_id);
    const unlocked = unlockedSet.has(r.id);
    return {
      id: r.id,
      projectTitle: t?.title ?? "Project",
      projectSlug: t?.slug ?? "",
      team: r.adopter_team_name,
      meta: `Sent ${timeAgo(r.created_at)}${r.decided_at ? ` · decided ${formatDate(r.decided_at)}` : ""}`,
      status: r.status,
      unlocked,
      needsAgreement: r.status === "approved" && !unlocked && !myAccepted.has(r.id),
    };
  };
  const sent = requests.filter((r) => r.created_by === userId || r.members.some((m) => m.email.toLowerCase() === email.toLowerCase())).map(toReq);
  const received = requests.filter((r) => projectIds.includes(r.project_id)).map(toReq);

  const notifications = ((notifRows ?? []) as NotificationRow[]).map((n) => ({
    id: n.id,
    ...describeNotification(n),
    unread: !n.read_at,
    when: timeAgo(n.created_at),
  }));

  return {
    projects: dashProjects,
    sent,
    received,
    notifications,
    tiles: {
      decisions: received.filter((r) => r.status === "pending").length,
      drafts: dashProjects.filter((p) => p.ctaTone === "blue").length,
      sentPending: sent.filter((r) => r.status === "pending").length,
    },
    hasDemo: dashProjects.some((p) => p.isDemo) || sent.length > 0,
  };
}
