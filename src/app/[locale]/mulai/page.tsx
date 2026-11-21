import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Share2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageShell } from "@/components/ui/PageShell";
import { MarkWelcomed } from "@/components/features/MarkWelcomed";

export const metadata: Metadata = { title: "Get started", robots: { index: false } };

/**
 * First-run screen. It only guides the first visit. Nothing chosen here is stored as a role:
 * the same account can share projects and continue other people's projects at any time.
 */
export default async function StartPage() {
  await requireUser("/mulai");
  const cards = [
    {
      href: "/share",
      icon: <Share2 size={28} aria-hidden="true" />,
      title: "Share a project",
      text: "Finished or paused a project? Add your team and advisor, and let the next team pick it up.",
    },
    {
      href: "/explore",
      icon: <Compass size={28} aria-hidden="true" />,
      title: "Explore projects",
      text: "Browse verified projects and find one you can continue. Some open right away, others ask the owners first.",
    },
  ];
  return (
    <PageShell width={880}>
      <MarkWelcomed />
      <h1 className="mb-2 mt-0 text-[40px] font-medium max-sm:text-[30px]">What do you want to do?</h1>
      <p className="mb-8 mt-0 max-w-[560px] text-text-2">
        You can do both with the same account, now or later. This only helps you start.
      </p>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5 p-0">
        {cards.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="flex h-full flex-col gap-3 rounded-[28px] border border-line-soft bg-surface p-7 text-ink no-underline transition-transform hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(10,60,150,0.12)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime text-ink">{c.icon}</span>
              <span className="text-[24px] font-medium">{c.title}</span>
              <span className="text-text-2">{c.text}</span>
              <span className="mt-auto flex items-center gap-2 font-semibold text-blue-dark">
                Start <ArrowRight size={18} aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mb-0 mt-8 text-sm">
        <Link href="/dasbor">Skip to my dashboard</Link>
      </p>
    </PageShell>
  );
}
