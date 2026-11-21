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
import { ToastProvider, type ToastLabels } from "@/components/ui/Toast";

const EN_TOAST: ToastLabels = { undo: "Undo", undone: "Undone.", dismiss: "Dismiss", region: "Notifications" };

const GROUPS: { label: string; items: { href: string; label: string; exact?: boolean }[] }[] = [
  { label: "Overview", items: [{ href: "/admin", label: "Overview", exact: true }] },
  {
    label: "Moderation",
    items: [
      { href: "/admin/projects", label: "Projects" },
      { href: "/admin/reports", label: "Reports" },
      { href: "/admin/appeals", label: "Appeals" },
    ],
  },
  { label: "People", items: [{ href: "/admin/users", label: "Users" }] },
  {
    label: "Operations",
    items: [
      { href: "/admin/pipeline", label: "Pipeline" },
      { href: "/admin/requests", label: "Requests" },
    ],
  },
  { label: "Evidence", items: [{ href: "/admin/trials", label: "Trials" }] },
  {
    label: "Governance",
    items: [
      { href: "/admin/audit", label: "Audit" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
];

const SHORTCUTS: [string, string, string][] = [
  ["g then o", "Overview", "/admin"],
  ["g then p", "Projects", "/admin/projects"],
  ["g then r", "Reports", "/admin/reports"],
  ["g then u", "Users", "/admin/users"],
  ["g then a", "Audit", "/admin/audit"],
];
const GO: Record<string, string> = {
  o: "/admin",
  p: "/admin/projects",
  r: "/admin/reports",
  u: "/admin/users",
  a: "/admin/audit",
};

const ENV_STYLE = {
  LOCAL: "bg-ok-bg text-ok",
  STAGING: "bg-warn-bg text-warn",
  PRODUCTION: "bg-danger text-white",
} as const;

interface Hit {
  id: string;
  title: string;
  sub: string;
}
type Results = { projects: Hit[]; users: Hit[]; reports: Hit[] };

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
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
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        if (r.ok) setRes((await r.json()) as Results);
      } catch {
        /* aborted or offline */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const shown = q.trim().length >= 2 ? res : null;
  const groups: { title: string; hits: Hit[]; href: (h: Hit) => string }[] = shown
    ? [
        { title: "Projects", hits: shown.projects, href: (h) => `/admin/projects/${h.id}` },
        { title: "Users", hits: shown.users, href: (h) => `/admin/users/${h.id}` },
        { title: "Reports", hits: shown.reports, href: (h) => `/admin/reports?open=${h.id}` },
      ]
    : [];
  const first = groups.flatMap((g) => g.hits.map((h) => g.href(h)))[0];

  return (
    <Popover.Root open={open && !!shown} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="relative min-w-0 flex-1 max-w-[420px]">
          <label htmlFor="admin-global-search" className="sr-only">
            Search projects, users and reports
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
            placeholder="Search (press /)"
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
          {groups.every((g) => g.hits.length === 0) ? <p className="m-2 text-sm text-text-2">No matches.</p> : null}
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

export function AdminShell({
  adminName,
  env,
  children,
}: {
  adminName: string;
  env: "LOCAL" | "STAGING" | "PRODUCTION";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [help, setHelp] = useState(false);
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setDrawer(false);
  }

  // g then <letter> navigation and "?" for help. Never fires while typing or with modifier keys.
  useEffect(() => {
    let armed = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable))
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        setHelp((v) => !v);
        return;
      }
      if (e.key === "Escape") setHelp(false);
      if (armed && Date.now() - armed < 1200 && GO[e.key]) {
        armed = 0;
        router.push(GO[e.key]);
        return;
      }
      armed = e.key === "g" ? Date.now() : 0;
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-4">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <div className="mono-label px-3 pb-1 text-[11px] text-text-2">{g.label}</div>
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
                    {i.label}
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
    <ToastProvider labels={EN_TOAST}>
      <div className="flex min-h-screen bg-[#f7f8fa]">
        <aside className="sticky top-0 hidden h-screen w-[230px] flex-none flex-col gap-5 overflow-auto border-r border-line bg-surface p-4 min-[900px]:flex">
          <Link href="/admin" className="flex items-center gap-2 px-2 text-ink no-underline">
            <LogoMark size={26} />
            <span className="font-semibold tracking-[0.02em]">ESTAFET</span>
            <span className="mono-label rounded bg-ink px-1.5 py-0.5 text-[10px] text-white">Admin</span>
          </Link>
          {nav}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-sticky flex flex-wrap items-center gap-3 border-b border-line bg-white/90 px-4 py-2.5 backdrop-blur">
            <Dialog open={drawer} onOpenChange={setDrawer}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  aria-label="Open menu"
                  className="icon-btn flex h-11 w-11 cursor-pointer items-center justify-center rounded-full hover:bg-surface min-[900px]:hidden"
                >
                  <Menu size={20} aria-hidden="true" />
                </button>
              </DialogTrigger>
              <DialogContent variant="drawer" title="ESTAFET Admin" closeLabel="Close menu" className="bg-surface">
                <div className="mt-10">{nav}</div>
              </DialogContent>
            </Dialog>
            <GlobalSearch />
            <Tip label="Current environment">
              <span tabIndex={0} className={cn("mono-label rounded-full px-3 py-1 text-[11px]", ENV_STYLE[env])}>
                {env}
              </span>
            </Tip>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => setHelp(true)}
                className="hidden cursor-pointer rounded-full px-3 py-1.5 font-semibold text-text-2 hover:bg-surface sm:block"
              >
                Shortcuts
              </button>
              <Link href="/" className="inline-flex items-center gap-1 text-text-2 no-underline hover:text-ink">
                Public site <ExternalLink size={14} aria-hidden="true" />
              </Link>
              <Tip label="Signed in as">
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

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent title="Keyboard shortcuts" closeLabel="Close" className="max-w-[380px]">
          <table className="mt-3 w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1 font-code">/</td>
                <td>Focus search</td>
              </tr>
              {SHORTCUTS.map(([k, l]) => (
                <tr key={k}>
                  <td className="py-1 font-code">{k}</td>
                  <td>Go to {l}</td>
                </tr>
              ))}
              <tr>
                <td className="py-1 font-code">?</td>
                <td>Show or hide this help</td>
              </tr>
              <tr>
                <td className="py-1 font-code">Enter</td>
                <td>Open the focused table row</td>
              </tr>
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </ToastProvider>
  );
}
