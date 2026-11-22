import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BreakGlassBanner } from "@/components/admin/BreakGlassBanner";
import { KeyValueList, Panel } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/Button";
import { formatWita, type AdminLocale } from "@/lib/admin/time";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.bgview" });
  return { title: t("title") };
}

export default async function BreakGlassViewPage({ params }: { params: Promise<{ id: string; access: string }> }) {
  const { id, access } = await params;
  const [locale, t] = await Promise.all([getLocale(), getTranslations("admin.bgview")]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_break_glass_get", { p_access: access });
  const info = data as {
    file_name: string;
    kind: string;
    expires_at: string;
    project_id: string;
    reason: string;
  } | null;
  if ((error && !/expired/i.test(error.message)) || (!error && (!info || info.project_id !== id))) notFound();

  if (error || !info) {
    return (
      <Panel title={t("title")}>
        <p role="status" className="mt-0 font-semibold">
          {t("expired")}
        </p>
        <p className="text-sm text-text-2">{t("expiredHelp")}</p>
        <Link href={`/admin/projects/${id}`}>{t("back")}</Link>
      </Panel>
    );
  }

  return (
    <>
      <BreakGlassBanner expiresAt={info.expires_at} />
      <div className="pt-10">
        <h1 className="mt-0 text-[26px] font-medium">{t("heading", { file: info.file_name })}</h1>
        <Panel title={t("thisAccess")}>
          <KeyValueList
            items={[
              { label: t("file"), value: <code className="font-code">{info.file_name}</code> },
              { label: t("type"), value: info.kind },
              { label: t("reason"), value: info.reason },
              { label: t("expires"), value: formatWita(info.expires_at, locale as AdminLocale) },
            ]}
          />
          <p className="mb-3 mt-4 text-sm text-text-2">{t("note")}</p>
          <ButtonLink href={`/api/admin/break-glass/${access}`} prefetch={false} target="_blank" rel="noreferrer" arrow>
            {t("openFile")}
          </ButtonLink>
        </Panel>
        <p className="mt-4">
          <Link href={`/admin/projects/${id}`}>{t("back")}</Link>
        </p>
      </div>
    </>
  );
}
