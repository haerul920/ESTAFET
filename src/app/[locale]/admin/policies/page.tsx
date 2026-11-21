import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/guard";
import { ReasonAction } from "@/components/admin/ReasonDialog";
import { EmptyState, PageHeader, Panel, StatusPill, Time } from "@/components/admin/ui";
import { publishPolicy } from "@/app/[locale]/admin/actions";

export const metadata: Metadata = { title: "Policies" };

interface Row {
  id: string;
  kind: "terms" | "privacy";
  version: number;
  effective_at: string;
  accepted: number;
  people: number;
  is_current: boolean;
}

const KINDS = [
  { kind: "terms", label: "Terms and Conditions" },
  { kind: "privacy", label: "Privacy Policy" },
] as const;

/** Policy versions. Publishing a new one makes every signed-in person accept it again before they continue. */
export default async function AdminPoliciesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("admin_policies_v").select("*").order("version", { ascending: false });
  const rows = (data ?? []) as Row[];

  return (
    <>
      <PageHeader
        title="Policies"
        intro="The wording of each document lives in the app's message files and is changed with a code release. Here you publish the new version number, which makes everyone accept it again."
      />
      {rows.length === 0 ? (
        <EmptyState title="No policy versions" text="Run the database setup first." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {KINDS.map(({ kind, label }) => {
            const list = rows.filter((r) => r.kind === kind);
            const current = list.find((r) => r.is_current);
            const next = (current?.version ?? 0) + 1;
            return (
              <Panel key={kind} title={label}>
                <p className="mb-3 mt-0 text-sm">
                  Current version: <strong>{current?.version ?? "none"}</strong>
                  {current ? (
                    <>
                      {" "}
                      · accepted by{" "}
                      <strong>
                        {current.accepted} of {current.people}
                      </strong>{" "}
                      people
                      {current.people > 0 ? ` (${Math.round((current.accepted / current.people) * 100)}%)` : ""}
                    </>
                  ) : null}
                </p>
                <ul className="m-0 mb-4 flex list-none flex-col gap-1.5 p-0 text-sm">
                  {list.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Version {r.version} <span className="text-text-2">from </span>
                        <Time iso={r.effective_at} className="inline" />
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-text-2">
                          {r.accepted} of {r.people}
                        </span>
                        {r.is_current ? <StatusPill tone="ok">current</StatusPill> : <StatusPill>older</StatusPill>}
                      </span>
                    </li>
                  ))}
                </ul>
                <ReasonAction
                  label={`Publish version ${next}`}
                  tone="outline"
                  consequence={
                    <>
                      Version {next} becomes current now. Every signed-in person must accept it before using protected
                      pages again, and publishing a project needs the new version. Publish it only after the new wording
                      is released. Needs a recent password check.
                    </>
                  }
                  reasonLabel="What changed and why (kept in the audit log)"
                  action={publishPolicy.bind(null, kind, next)}
                  successMessage={`Version ${next} published.`}
                />
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
