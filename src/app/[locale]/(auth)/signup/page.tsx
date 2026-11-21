import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/ui/PageShell";
import { AuthForm } from "@/components/features/AuthForm";
import { signup } from "@/app/actions/auth";
import { safeNext } from "@/lib/validation";
import { getSettings } from "@/lib/settings";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "auth" });
  return { title: tm("signupMeta") };
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const t = await getTranslations("auth");
  const domains = (await getSettings()).allowed_email_domains.value;
  return (
    <PageShell width={520}>
      <h1 className="mb-2 mt-0 text-[36px] font-medium">{t("signupTitle")}</h1>
      <p className="mb-6 mt-0 text-text-2">
        {domains.length ? t("signupDomains", { domains: domains.join(", ") }) : t("signupLead")}
      </p>
      <AuthForm mode="signup" action={signup} next={safeNext(next)} />
    </PageShell>
  );
}
