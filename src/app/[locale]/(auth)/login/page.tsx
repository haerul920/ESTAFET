import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/ui/PageShell";
import { AuthForm } from "@/components/features/AuthForm";
import { login } from "@/app/actions/auth";
import { safeNext } from "@/lib/validation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "auth" });
  return { title: tm("loginMeta") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <PageShell width={520}>
      <h1 className="mb-2 mt-0 text-[36px] font-medium">{t("loginTitle")}</h1>
      <p className="mb-6 mt-0 text-text-2">{t("loginLead")}</p>
      <AuthForm mode="login" action={login} next={safeNext(next)} />
    </PageShell>
  );
}
