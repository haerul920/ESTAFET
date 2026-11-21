import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/guard";
import { ReasonAction } from "@/components/admin/ReasonDialog";
import { EmptyState, PageHeader, Panel, StatusPill, Time } from "@/components/admin/ui";
import { publishPolicy } from "@/app/[locale]/admin/actions";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.policies" });
  return { title: t("title") };
}

interface Row {
  id: string;
  kind: "terms" | "privacy";
  version: number;
  effective_at: string;
  accepted: number;
  people: number;
  is_current: boolean;
}

const KINDS = ["terms", "privacy"] as const;

/** Policy versions. Publishing a new one makes every signed-in person accept it again before they continue. */
export default async function AdminPoliciesPage() {
  await requireAdmin();
  const [t, ts] = await Promise.all([getTranslations("admin.policies"), getTranslations("admin.status")]);
  const supabase = await createClient();
  const { data } = await supabase.from("admin_policies_v").select("*").order("version", { ascending: false });
  const rows = (data ?? []) as Row[];

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      {rows.length === 0 ? (
        <EmptyState title={t("emptyTitle")} text={t("emptyText")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {KINDS.map((kind) => {
            const list = rows.filter((r) => r.kind === kind);
            const current = list.find((r) => r.is_current);
            const next = (current?.version ?? 0) + 1;
            const percent =
              current && current.people > 0 ? ` (${Math.round((current.accepted / current.people) * 100)}%)` : "";
            return (
              <Panel key={kind} title={t(kind)}>
                <p className="mb-3 mt-0 text-sm">
                  {t("currentVersion", { version: current?.version ?? t("none") })}
                  {current
                    ? ` · ${t("acceptedBy", { accepted: current.accepted, people: current.people, percent })}`
                    : ""}
                </p>
                <ul className="m-0 mb-4 flex list-none flex-col gap-1.5 p-0 text-sm">
                  {list.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {t("versionFrom", { version: r.version })} <Time iso={r.effective_at} className="inline" />
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-text-2">{t("ofPeople", { accepted: r.accepted, people: r.people })}</span>
                        {r.is_current ? (
                          <StatusPill tone="ok">{ts("current")}</StatusPill>
                        ) : (
                          <StatusPill>{ts("older")}</StatusPill>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <ReasonAction
                  label={t("publish", { version: next })}
                  tone="outline"
                  consequence={t("effect", { version: next })}
                  reasonLabel={t("reasonLabel")}
                  action={publishPolicy.bind(null, kind, next)}
                  successMessage={t("published", { version: next })}
                />
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
