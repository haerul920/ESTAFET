import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader, Panel } from "@/components/admin/ui";
import { SettingRow } from "@/components/admin/SettingRow";
import { PurgeControl } from "@/components/admin/PurgeControl";
import { getSettings } from "@/lib/settings";
import { environmentName, isProduction } from "@/lib/admin/env";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.settings" });
  return { title: t("title") };
}

export default async function AdminSettingsPage() {
  const [s, t] = await Promise.all([getSettings(), getTranslations("admin.settings")]);
  const env = environmentName();
  const onOff = (v: boolean) => (v ? t("on") : t("off"));
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />

      <Panel title={t("groupAccess")} className="mb-4">
        <SettingRow
          settingKey="registrations_open"
          label={t("registrations.label")}
          help={t("registrations.help")}
          kind="boolean"
          value={s.registrations_open.value}
          source={s.registrations_open.source}
          fallback={onOff(s.registrations_open.fallback)}
        />
        <SettingRow
          settingKey="allowed_email_domains"
          label={t("domains.label")}
          help={t("domains.help")}
          kind="list"
          value={s.allowed_email_domains.value.join(", ")}
          source={s.allowed_email_domains.source}
          fallback={s.allowed_email_domains.fallback.join(", ") || t("anyDomain")}
        />
        <SettingRow
          settingKey="contact_email"
          label={t("contact.label")}
          help={t("contact.help")}
          kind="email"
          value={s.contact_email.value}
          source={s.contact_email.source}
          fallback={s.contact_email.fallback || t("none")}
        />
      </Panel>

      <Panel title={t("groupLimits")} className="mb-4">
        <SettingRow
          settingKey="max_upload_mb"
          label={t("upload.label")}
          help={t("upload.help")}
          kind="number"
          unit="MB"
          value={String(s.max_upload_mb.value)}
          source={s.max_upload_mb.source}
          fallback={`${s.max_upload_mb.fallback} MB`}
        />
        <SettingRow
          settingKey="synthesis_daily_cap"
          label={t("cap.label")}
          help={t("cap.help")}
          kind="number"
          unit={t("cap.unit")}
          value={String(s.synthesis_daily_cap.value)}
          source={s.synthesis_daily_cap.source}
          fallback={`${s.synthesis_daily_cap.fallback} ${t("cap.unit")}`}
        />
        <SettingRow
          settingKey="request_expiry_days"
          label={t("expiry.label")}
          help={t("expiry.help")}
          kind="number"
          unit={t("days")}
          value={String(s.request_expiry_days.value)}
          source={s.request_expiry_days.source}
          fallback={`${s.request_expiry_days.fallback} ${t("days")}`}
        />
        <SettingRow
          settingKey="reapply_cooldown_days"
          label={t("cooldown.label")}
          help={t("cooldown.help")}
          kind="number"
          unit={t("days")}
          value={String(s.reapply_cooldown_days.value)}
          source={s.reapply_cooldown_days.source}
          fallback={`${s.reapply_cooldown_days.fallback} ${t("days")}`}
        />
      </Panel>

      <Panel title={t("groupModeration")} className="mb-4">
        <SettingRow
          settingKey="report_hold_threshold"
          label={t("threshold.label")}
          help={t("threshold.help")}
          kind="number"
          unit={t("threshold.unit")}
          value={String(s.report_hold_threshold.value)}
          source={s.report_hold_threshold.source}
          fallback={`${s.report_hold_threshold.fallback} ${t("threshold.unit")}`}
        />
        <SettingRow
          settingKey="hold_review_days"
          label={t("review.label")}
          help={t("review.help")}
          kind="number"
          unit={t("days")}
          value={String(s.hold_review_days.value)}
          source={s.hold_review_days.source}
          fallback={`${s.hold_review_days.fallback} ${t("days")}`}
        />
      </Panel>

      <Panel title={t("groupDisplay")} className="mb-4">
        <SettingRow
          settingKey="show_demo_banner"
          label={t("banner.label")}
          help={t("banner.help")}
          kind="boolean"
          value={s.show_demo_banner.value}
          source={s.show_demo_banner.source}
          fallback={onOff(s.show_demo_banner.fallback)}
        />
      </Panel>

      <section aria-labelledby="danger-h" className="rounded-3xl border-2 border-danger bg-[#fdecea] p-5">
        <h2 id="danger-h" className="mt-0 text-base text-danger">
          {t("danger")}
        </h2>
        <p className="mb-3 mt-1 text-sm text-text-3">{t("dangerText", { env })}</p>
        <PurgeControl blocked={isProduction()} env={env} />
      </section>
    </>
  );
}
