import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/admin/ui";
import { SettingRow } from "@/components/admin/SettingRow";
import { PurgeControl } from "@/components/admin/PurgeControl";
import { getSettings } from "@/lib/settings";
import { environmentName, isProduction } from "@/lib/admin/env";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const s = await getSettings();
  const env = environmentName();
  return (
    <>
      <PageHeader
        title="Settings"
        intro="Settings override the environment defaults and apply immediately. Every change needs a reason and a recent password check."
      />

      <Panel title="Access" className="mb-4">
        <SettingRow
          settingKey="registrations_open"
          label="Registrations open"
          help="Turn off to stop new sign-ups. Existing users can still sign in."
          kind="boolean"
          value={s.registrations_open.value}
          source={s.registrations_open.source}
          fallback={s.registrations_open.fallback ? "on" : "off"}
        />
        <SettingRow
          settingKey="allowed_email_domains"
          label="Allowed email domains"
          help="Comma or line separated. Empty allows any email (demo mode)."
          kind="list"
          value={s.allowed_email_domains.value.join(", ")}
          source={s.allowed_email_domains.source}
          fallback={s.allowed_email_domains.fallback.join(", ") || "any domain"}
        />
        <SettingRow
          settingKey="contact_email"
          label="Contact address"
          help="Shown to suspended users so they can reach the team."
          kind="email"
          value={s.contact_email.value}
          source={s.contact_email.source}
          fallback={s.contact_email.fallback || "none"}
        />
      </Panel>

      <Panel title="Limits" className="mb-4">
        <SettingRow
          settingKey="max_upload_mb"
          label="Maximum upload size"
          help="Per file, checked on the next upload."
          kind="number"
          unit="MB"
          value={String(s.max_upload_mb.value)}
          source={s.max_upload_mb.source}
          fallback={`${s.max_upload_mb.fallback} MB`}
        />
        <SettingRow
          settingKey="synthesis_daily_cap"
          label="Synthesis runs per user per day"
          help="Retries count toward the cap of the person who started the run."
          kind="number"
          unit="runs"
          value={String(s.synthesis_daily_cap.value)}
          source={s.synthesis_daily_cap.source}
          fallback={`${s.synthesis_daily_cap.fallback} runs`}
        />
        <SettingRow
          settingKey="request_expiry_days"
          label="Request expiry"
          help="A pending continuation request with no decision expires after this many days. Applies to new requests."
          kind="number"
          unit="days"
          value={String(s.request_expiry_days.value)}
          source={s.request_expiry_days.source}
          fallback={`${s.request_expiry_days.fallback} days`}
        />
        <SettingRow
          settingKey="reapply_cooldown_days"
          label="Re-apply cooldown"
          help="After a decline, the same account must wait this long before asking again. Zero turns it off."
          kind="number"
          unit="days"
          value={String(s.reapply_cooldown_days.value)}
          source={s.reapply_cooldown_days.source}
          fallback={`${s.reapply_cooldown_days.fallback} days`}
        />
      </Panel>

      <Panel title="Moderation" className="mb-4">
        <SettingRow
          settingKey="report_hold_threshold"
          label="Reporters needed for an automatic hold"
          help="For copyright, personal data and harmful file reports, a project is held when this many different reporters (verified accounts or distinct visitors) report it. One person can never hold a project alone."
          kind="number"
          unit="reporters"
          value={String(s.report_hold_threshold.value)}
          source={s.report_hold_threshold.source}
          fallback={`${s.report_hold_threshold.fallback} reporters`}
        />
        <SettingRow
          settingKey="hold_review_days"
          label="Hold review target"
          help="A held project should be reviewed within this many days. After that, every admin gets an alert."
          kind="number"
          unit="days"
          value={String(s.hold_review_days.value)}
          source={s.hold_review_days.source}
          fallback={`${s.hold_review_days.fallback} days`}
        />
      </Panel>

      <Panel title="Display" className="mb-4">
        <SettingRow
          settingKey="show_demo_banner"
          label="Show the demo banner"
          help="A thin banner on public pages that says sample projects are simulated demo data."
          kind="boolean"
          value={s.show_demo_banner.value}
          source={s.show_demo_banner.source}
          fallback={s.show_demo_banner.fallback ? "on" : "off"}
        />
      </Panel>

      <section aria-labelledby="danger-h" className="rounded-3xl border-2 border-danger bg-[#fdecea] p-5">
        <h2 id="danger-h" className="mt-0 text-base text-danger">
          Danger zone
        </h2>
        <p className="mb-3 mt-1 text-sm text-text-3">
          Environment: <strong>{env}</strong>. Purging removes only rows marked as demo data, and works only outside
          production.
        </p>
        <PurgeControl blocked={isProduction()} env={env} />
      </section>
    </>
  );
}
