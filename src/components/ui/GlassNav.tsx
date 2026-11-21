"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, LogOut, Menu, X, LayoutDashboard } from "lucide-react";
import { LogoMark } from "./Logo";
import { ButtonLink } from "./Button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/cn";

export interface NavUser {
  name: string;
  initials: string;
  unread: number;
}

const LINKS = [
  { href: "/explore", key: "explore" },
  { href: "/dasbor", key: "dashboard" },
] as const;

/**
 * Liquid glass navigation pill. `hero` sits on the saturated sky (white text),
 * `strip` sits on the light sky strip of inner pages (ink text).
 */
export function GlassNav({ variant = "strip", user }: { variant?: "hero" | "strip"; user: NavUser | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);
  const hero = variant === "hero";

  // Close menus when the route changes (state adjusted during render, not in an effect).
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMenuOpen(false);
    setUserOpen(false);
  }

  useEffect(() => {
    if (!userOpen) return;
    const close = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setUserOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [userOpen]);

  const textColor = hero ? "text-white" : "text-ink";
  const base = LINKS.map((l) => ({ href: l.href as string, label: t(l.key) }));
  const links = hero ? [base[0], { href: "/#how", label: t("how") }, base[1]] : base;

  return (
    <motion.nav
      aria-label={t("main")}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative z-20 mx-auto flex max-w-[1040px] items-center justify-between gap-3 rounded-full py-2.5 pl-[22px] pr-2.5",
        hero ? "glass" : "glass glass-strong",
      )}
    >
      <Link href="/" aria-label={t("home")} className={cn("flex items-center gap-2.5 no-underline", textColor)}>
        <LogoMark size={30} onSky={hero} />
        <span className="text-[19px] font-semibold tracking-[0.02em]">ESTAFET</span>
      </Link>

      <ul className="m-0 hidden list-none items-center gap-1 p-0 md:flex">
        {links.map((l) => {
          const active = l.href.startsWith("/#") ? false : pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <li key={l.href} className="relative">
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "mono-label relative z-10 block rounded-full px-4 py-[11px] no-underline transition-opacity hover:opacity-80",
                  textColor,
                )}
              >
                {l.label}
              </Link>
              {active ? (
                <motion.span
                  layoutId="nav-active"
                  className={cn("absolute inset-0 rounded-full", hero ? "bg-white/25" : "bg-white/85")}
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-2">
        <LanguageSwitcher tone={hero ? "light" : "dark"} className="hidden sm:flex" />
        <ButtonLink href="/share" size="sm" arrow className="hidden sm:inline-flex">
          {t("share")}
        </ButtonLink>

        {user ? (
          <div ref={userRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={userOpen}
              onClick={() => setUserOpen((v) => !v)}
              className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black text-[13px] font-semibold text-lime"
            >
              <span className="sr-only">
                {t("account", { name: user.name })}
                {user.unread > 0 ? t("accountUnread", { count: user.unread }) : ""}
              </span>
              <span aria-hidden="true">{user.initials}</span>
              {user.unread > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-lime px-1 text-[11px] font-bold text-black ring-2 ring-white"
                >
                  {user.unread}
                </span>
              ) : null}
            </button>
            <AnimatePresence>
              {userOpen ? (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 top-[calc(100%+10px)] z-30 w-60 origin-top-right rounded-3xl border border-line bg-white p-2 text-ink shadow-[0_20px_50px_rgba(10,60,150,0.2)]"
                >
                  <p className="m-0 truncate px-3 py-2 text-sm font-semibold">{user.name}</p>
                  <Link
                    role="menuitem"
                    href="/dasbor"
                    className="flex min-h-[44px] items-center gap-2.5 rounded-2xl px-3 text-[15px] text-ink no-underline hover:bg-surface"
                  >
                    <LayoutDashboard size={18} aria-hidden="true" /> {t("dashboard")}
                  </Link>
                  <Link
                    role="menuitem"
                    href="/dasbor#notifikasi"
                    className="flex min-h-[44px] items-center gap-2.5 rounded-2xl px-3 text-[15px] text-ink no-underline hover:bg-surface"
                  >
                    <Bell size={18} aria-hidden="true" /> {t("notifications")}
                    {user.unread > 0 ? (
                      <span className="ml-auto rounded-full bg-lime px-2 text-xs font-semibold">{user.unread}</span>
                    ) : null}
                  </Link>
                  <form action={signOut}>
                    <button
                      role="menuitem"
                      type="submit"
                      className="flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-2xl px-3 text-left text-[15px] hover:bg-surface"
                    >
                      <LogOut size={18} aria-hidden="true" /> {t("signOut")}
                    </button>
                  </form>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : (
          <Link
            href="/login"
            className={cn(
              "mono-label hidden min-h-[44px] items-center rounded-full px-4 no-underline hover:opacity-80 sm:flex",
              textColor,
            )}
          >
            {t("signIn")}
          </Link>
        )}

        <button
          type="button"
          aria-label={menuOpen ? t("menuClose") : t("menuOpen")}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className={cn("flex h-11 w-11 cursor-pointer items-center justify-center rounded-full md:hidden", textColor)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 top-[calc(100%+10px)] rounded-[28px] border border-line bg-white p-3 text-ink shadow-[0_20px_50px_rgba(10,60,150,0.2)] md:hidden"
          >
            <ul className="m-0 flex list-none flex-col p-0">
              {[...links, { href: "/share", label: t("share") }, ...(user ? [] : [{ href: "/login", label: t("signIn") }])].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="mono-label flex min-h-[48px] items-center rounded-2xl px-4 text-ink no-underline hover:bg-surface"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex justify-center border-t border-line pt-2">
              <LanguageSwitcher />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.nav>
  );
}
