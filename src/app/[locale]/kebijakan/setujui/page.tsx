import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { hasAcceptedPolicies } from "@/lib/db/access";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/validation";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { acceptPoliciesAndContinue } from "@/app/actions/account";
import { signOut } from "@/app/actions/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "policyGate" });
  return { title: tm("metaTitle"), robots: { index: false } };
}

/**
 * Shown to a signed-in person when a newer version of the Terms or the Privacy Policy exists than the one they accepted.
 * Until they accept, protected pages send them here (see `requireUser`).
 */
export default async function PolicyGatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  await requireUser(`/kebijakan/setujui?next=${encodeURIComponent(next)}`, { skipPolicyCheck: true, allowAdmin: true });
  const locale = await getLocale();
  if (await hasAcceptedPolicies()) redirect({ href: next, locale });

  const t = await getTranslations("policyGate");
  const supabase = await createClient();
  const [terms, privacy] = await Promise.all([
    supabase.rpc("current_policy_version", { p_kind: "terms" }),
    supabase.rpc("current_policy_version", { p_kind: "privacy" }),
  ]);

  return (
    <PageShell width={680}>
      <Card className="mt-4 flex flex-col gap-4">
        <h1 className="m-0 text-3xl font-medium max-sm:text-2xl">{t("title")}</h1>
        <p className="m-0 text-text-2">{t("text")}</p>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          <li>
            <Link href="/terms" className="link-anim font-semibold text-blue">
              {t("terms", { version: String(terms.data ?? "") })}
            </Link>
          </li>
          <li>
            <Link href="/privacy" className="link-anim font-semibold text-blue">
              {t("privacy", { version: String(privacy.data ?? "") })}
            </Link>
          </li>
        </ul>
        <p className="m-0 rounded-[14px] bg-warn-bg p-3 text-sm text-warn-ink">{t("draft")}</p>
        {error === "unchecked" || error === "failed" ? (
          <FormMessage tone="error">{t(error === "unchecked" ? "errorUnchecked" : "errorFailed")}</FormMessage>
        ) : null}
        <form action={acceptPoliciesAndContinue} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
            <input type="checkbox" name="accept" required className="mt-1 h-5 w-5 flex-none accent-[var(--blue)]" />
            <span className="text-[15px]">{t("accept")}</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">{t("button")}</Button>
          </div>
        </form>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            {t("signOut")}
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}
