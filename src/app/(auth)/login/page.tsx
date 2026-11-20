import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { AuthForm } from "@/components/features/AuthForm";
import { login } from "@/app/actions/auth";
import { safeNext } from "@/lib/validation";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <PageShell width={520}>
      <h1 className="mb-2 mt-0 text-[36px] font-medium">Sign in</h1>
      <p className="mb-6 mt-0 text-text-2">Sign in to share a project, review requests or continue someone&apos;s work.</p>
      <AuthForm mode="login" action={login} next={safeNext(next)} />
    </PageShell>
  );
}
