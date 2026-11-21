import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLatestConsent, getTeam } from "@/lib/db/owner";
import type { AdvisorConsent, LineageEvent, Project, ProjectMember } from "@/lib/db/types";

export interface SettingsRequest {
  id: string;
  adopter_team_name: string;
  status: "pending" | "approved" | "declined" | "withdrawn" | "expired";
  purpose: string;
  created_at: string;
  expires_at: string | null;
  decided_at: string | null;
}

export interface SettingsHolder {
  id: string;
  profile_id: string;
  name: string;
  source: "open" | "approved_request";
  accepted_at: string;
  request_id: string | null;
}

export interface SettingsData {
  project: Project;
  team: (ProjectMember & { full_name: string })[];
  isPrimaryOwner: boolean;
  transfer: { from_profile: string; to_profile: string; from_name: string; to_name: string } | null;
  consent: AdvisorConsent | null;
  requests: SettingsRequest[];
  holders: SettingsHolder[];
  watchers: number;
  notifications: { id: string; type: string; payload: Record<string, unknown>; created_at: string; read_at: string | null }[];
  events: LineageEvent[];
}

/**
 * Everything the owners' settings page shows. Ownership is checked with the signed-in person's own client
 * (row level security), so a visitor or a non-owner gets null. Names and the watcher count need the service role.
 */
export async function loadSettings(slug: string, userId: string): Promise<SettingsData | null> {
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("slug", slug).maybeSingle();
  if (!project) return null;
  const { data: owns } = await supabase.rpc("is_project_owner", { pid: project.id });
  if (owns !== true) return null;

  const admin = createAdminClient();
  const [team, consent, requests, access, transfers, watchers, notifications, events] = await Promise.all([
    getTeam(project.id),
    getLatestConsent(project.id),
    supabase
      .from("continuation_requests")
      .select("id, adopter_team_name, status, purpose, created_at, expires_at, decided_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_access")
      .select("id, profile_id, source, accepted_at, request_id")
      .eq("project_id", project.id)
      .eq("status", "active")
      .order("accepted_at", { ascending: false }),
    supabase.from("ownership_transfers").select("from_profile, to_profile").eq("project_id", project.id).eq("status", "pending").maybeSingle(),
    admin.from("project_watchers").select("profile_id", { count: "exact", head: true }).eq("project_id", project.id),
    supabase
      .from("notifications")
      .select("id, type, payload, created_at, read_at")
      .eq("user_id", userId)
      .eq("payload->>project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("lineage_events").select("*").eq("project_id", project.id).order("created_at", { ascending: false }).limit(10),
  ]);

  const holderIds = (access.data ?? []).map((a) => a.profile_id as string);
  const transferIds = transfers.data ? [transfers.data.from_profile as string, transfers.data.to_profile as string] : [];
  const nameIds = [...new Set([...holderIds, ...transferIds])];
  const { data: names } = nameIds.length ? await admin.from("profiles").select("id, full_name").in("id", nameIds) : { data: [] };
  const nameOf = new Map((names ?? []).map((n: { id: string; full_name: string }) => [n.id, n.full_name]));

  return {
    project: project as Project,
    team,
    isPrimaryOwner: team.some((m) => m.profile_id === userId && m.role === "owner" && m.status === "active"),
    transfer: transfers.data
      ? {
          from_profile: transfers.data.from_profile as string,
          to_profile: transfers.data.to_profile as string,
          from_name: nameOf.get(transfers.data.from_profile as string) ?? "",
          to_name: nameOf.get(transfers.data.to_profile as string) ?? "",
        }
      : null,
    consent,
    requests: (requests.data ?? []) as SettingsRequest[],
    holders: (access.data ?? []).map((a) => ({
      id: a.id as string,
      profile_id: a.profile_id as string,
      name: nameOf.get(a.profile_id as string) ?? "",
      source: a.source as "open" | "approved_request",
      accepted_at: a.accepted_at as string,
      request_id: (a.request_id as string | null) ?? null,
    })),
    watchers: watchers.count ?? 0,
    notifications: (notifications.data ?? []) as SettingsData["notifications"],
    events: (events.data ?? []) as LineageEvent[],
  };
}
