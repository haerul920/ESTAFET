"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import * as Popover from "@radix-ui/react-popover";
import { ExternalLink, Menu, Search } from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Tip } from "@/components/ui/Tooltip";
import { ToastProvider } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { iconMotion } from "@/components/ui/motion-presets";

const GROUPS: { group: string; items: { href: string; key: string; exact?: boolean }[] }[] = [
  { group: "groupOverview", items: [{ href: "/admin", key: "navOverview", exact: true }] },
  {
    group: "groupModeration",
    items: [
      { href: "/admin/projects", key: "navProjects" },
      { href: "/admin/reports", key: "navReports" },
      { href: "/admin/appeals", key: "navAppeals" },
    ],
  },
  {
    group: "groupPeople",
    items: [
      { href: "/admin/users", key: "navUsers" },
      { href: "/admin/policies", key: "navPolicies" },
      { href: "/admin/announcements", key: "navAnnouncements" },
    ],
  },
  {
    group: "groupGovernance",
    items: [
      { href: "/admin/audit", key: "navAudit" },
      { href: "/admin/settings", key: "navSettings" },
    ],
  },
];

interface Hit {
  id: string;
  title: string;
  sub: string;
}
type Results = { projects: Hit[]; users: Hit[]; reports: Hit[] };

function GlobalSearch() {
  const t = useTranslations("admin.shell");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        if (r.ok) setRes((await r.json()) as Results);
      } catch {
        /* aborted or offline */
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [q]);

  const shown = q.trim().length >= 2 ? res : null;
  const groups: { title: string; hits: Hit[]; href: (h: Hit) => string }[] = shown
    ? [
        { title: t("hitProjects"), hits: shown.projects, href: (h) => `/admin/projects/${h.id}` },
        { title: t("hitUsers"), hits: shown.users, href: (h) => `/admin/users/${h.id}` },
        { title: t("hitReports"), hits: shown.reports, href: (h) => `/admin/reports?open=${h.id}` },
      ]
    : [];
  const first = groups.flatMap((g) => g.hits.map((h) => g.href(h)))[0];

  return (
    <Popover.Root open={open && !!shown} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="relative min-w-0 flex-1 max-w-[420px]">
          <label htmlFor="admin-global-search" className="sr-only">
            {t("searchLabel")}
          </label>
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2"
          />
          <input
            ref={input}
            id="admin-global-search"
            type="search"
            value={q}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && first) {
                router.push(first);
                setOpen(false);
              }
              if (e.key === "Escape") {
                setOpen(false);
                input.current?.blur();
              }
            }}
            className="min-h-[40px] w-full rounded-full border border-line-strong bg-white py-1.5 pl-10 pr-4 text-sm"
          />
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (e.target === input.current) e.preventDefault();
          }}
          className="o-menu z-dropdown max-h-[60vh] w-[var(--radix-popover-trigger-width)] min-w-[280px] overflow-auto rounded-2xl border border-line bg-white p-2 shadow-[0_20px_50px_rgba(10,60,150,0.2)]"
        >
          {groups.every((g) => g.hits.length === 0) ? (
            <p className="m-2 text-sm text-text-2">{t("noMatches")}</p>
          ) : null}
          {groups.map((g) =>
            g.hits.length ? (
              <div key={g.title} className="mb-1">
                <div className="mono-label px-3 py-1 text-[11px] text-text-2">{g.title}</div>
                {g.hits.map((h) => (
                  <Link
                    key={h.id}
                    href={g.href(h)}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-3 py-2 text-sm text-ink no-underline hover:bg-surface focus-visible:bg-surface"
                  >
                    <strong>{h.title}</strong>
                    <span className="block text-[13px] text-text-2">{h.sub}</span>
                  </Link>
                ))}
              </div>
            ) : null,
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function AdminShell({ adminName, children }: { adminName: string; children: React.ReactNode }) {
  const t = useTranslations("admin.shell");
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setDrawer(false);
  }

  // Navigation labels are picked by key (see messages admin.shell.*).
  const label = t as unknown as (key: string) => string;

  const nav = (
    <nav aria-label={t("nav")} className="flex flex-col gap-4">
      {GROUPS.map((g) => (
        <div key={g.group}>
          <div className="mono-label px-3 pb-1 text-[11px] text-text-2">{label(g.group)}</div>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {g.items.map((i) => {
              const active = i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + "/");
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-[38px] items-center rounded-xl px-3 text-sm font-medium no-underline transition-colors",
                      active ? "bg-ink text-white" : "text-ink hover:bg-white",
                    )}
                  >
                    {label(i.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[#f7f8fa]">
        <aside className="sticky top-0 hidden h-screen w-[230px] flex-none flex-col gap-5 overflow-auto border-r border-line bg-surface p-4 min-[900px]:flex">
          <Link href="/admin" className="flex items-center gap-2 px-2 text-ink no-underline">
            <LogoMark size={23} />
            <span className="sr-only">ESTAFET</span>
            <span className="mono-label rounded bg-ink px-1.5 py-0.5 text-[10px] text-white">{t("tag")}</span>
          </Link>
          {nav}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-sticky flex flex-wrap items-center gap-3 border-b border-line bg-white/90 px-4 py-2.5 backdrop-blur">
            <Dialog open={drawer} onOpenChange={setDrawer}>
              <DialogTrigger asChild>
                <motion.button
                  {...iconMotion}
                  type="button"
                  aria-label={t("openMenu")}
                  className="icon-press flex h-11 w-11 cursor-pointer items-center justify-center rounded-full hover:bg-surface min-[900px]:hidden"
                >
                  <Menu size={20} aria-hidden="true" />
                </motion.button>
              </DialogTrigger>
              <DialogContent variant="drawer" title={t("menuTitle")} closeLabel={t("closeMenu")} className="bg-surface">
                <div className="mt-10">{nav}</div>
              </DialogContent>
            </Dialog>
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-3 text-sm">
              <Link href="/" className="inline-flex items-center gap-1 text-text-2 no-underline hover:text-ink">
                {t("publicSite")} <ExternalLink size={14} aria-hidden="true" />
              </Link>
              <Tip label={t("signedInAs")}>
                <span tabIndex={0} className="font-semibold">
                  {adminName}
                </span>
              </Tip>
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
