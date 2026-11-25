import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/guard";
import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader, Panel, StatusPill, Time } from "@/components/admin/ui";
import { LEGAL_DOCS, LEGAL_PATHS, type LegalDocName } from "@/lib/legal/content";
import { getLegalDocument } from "@/lib/legal/load";

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

/**
 * The four documents. Each opens in a full page editor. Publishing the Terms or the Privacy Policy also publishes a new
 * version, which every signed-in person accepts again before they continue.
 */
export default async function AdminPoliciesPage() {
  await requireAdmin();
  const [t, ts] = await Promise.all([getTranslations("admin.policies"), getTranslations("admin.status")]);
  const supabase = await createClient();
  const [{ data }, documents] = await Promise.all([
    supabase.from("admin_policies_v").select("*").order("version", { ascending: false }),
    Promise.all(LEGAL_DOCS.map(async (doc) => [doc, await getLegalDocument(doc)] as const)),
  ]);
  const rows = (data ?? []) as Row[];
  const names: Record<LegalDocName, string> = {
    terms: t("terms"),
    privacy: t("privacy"),
    guidelines: t("guidelines"),
    attribution: t("attribution"),
  };

  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid gap-4 md:grid-cols-2">
        {documents.map(([doc, current]) => {
          const versions = rows.filter((r) => r.kind === doc);
          return (
            <Panel key={doc} title={names[doc]}>
              <p className="mb-3 mt-0 text-sm">
                {current.publishedAt ? (
                  <>
                    {t("lastPublished", { revision: current.revision })}{" "}
                    <Time iso={current.publishedAt} className="inline" />
                  </>
                ) : (
                  t("builtIn")
                )}
              </p>
              {versions.length > 0 ? (
                <ul className="m-0 mb-4 flex list-none flex-col gap-1.5 p-0 text-sm">
                  {versions.map((r) => (
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
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <ButtonLink
                  href={`/admin/policies/${doc}`}
                  variant="outlineBlue"
                  aria-label={t("editAria", { name: names[doc] })}
                >
                  {t("edit")}
                </ButtonLink>
                <Link href={LEGAL_PATHS[doc]} className="text-sm font-semibold">
                  {t("viewPage")}
                </Link>
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
