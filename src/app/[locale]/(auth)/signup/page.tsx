import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { AuthForm } from "@/components/features/AuthForm";
import { signup } from "@/app/actions/auth";
import { safeNext } from "@/lib/validation";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const domains = (await getSettings()).allowed_email_domains.value;
  return (
    <PageShell width={520}>
      <h1 className="mb-2 mt-0 text-[36px] font-medium">Create an account</h1>
      <p className="mb-6 mt-0 text-text-2">
        {domains.length
          ? `Use your university email (${domains.join(", ")}).`
          : "Any email works in this prototype. A university email domain check can be switched on with ALLOWED_EMAIL_DOMAINS."}
      </p>
      <AuthForm mode="signup" action={signup} next={safeNext(next)} />
    </PageShell>
  );
}
