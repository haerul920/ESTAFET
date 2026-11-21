"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { Bell, LogOut, Menu as MenuIcon, LayoutDashboard } from "lucide-react";
import { LogoMark } from "./Logo";
import { ButtonLink } from "./Button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "./Dialog";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "./Menu";
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
 * The account menu and the phone drawer are Radix overlays rendered in portals, so nothing can cover them.
 */
export function GlassNav({ variant = "strip", user }: { variant?: "hero" | "strip"; user: NavUser | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hero = variant === "hero";

  // Close the drawer when the route changes (state adjusted during render, not in an effect).
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setDrawerOpen(false);
  }

  const textColor = hero ? "text-white" : "text-ink";
  const base = LINKS.map((l) => ({ href: l.href as string, label: t(l.key) }));
  const links = hero ? [base[0], { href: "/#how", label: t("how") }, base[1]] : base;
  const drawerLinks = [...links, { href: "/share", label: t("share") }, ...(user ? [] : [{ href: "/login", label: t("signIn") }])];

  return (
    <motion.nav
      aria-label={t("main")}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative z-nav mx-auto flex max-w-[1040px] items-center justify-between gap-3 rounded-full py-2.5 pl-[22px] pr-2.5",
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
                className={cn("mono-label link-anim relative z-raised block rounded-full px-4 py-[11px]", textColor)}
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
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                className="icon-btn relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black text-[13px] font-semibold text-lime"
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
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>{user.name}</MenuLabel>
              <MenuItem asChild>
                <Link href="/dasbor">
                  <LayoutDashboard size={18} aria-hidden="true" /> {t("dashboard")}
                </Link>
              </MenuItem>
              <MenuItem asChild>
                <Link href="/dasbor#notifikasi">
                  <Bell size={18} aria-hidden="true" /> {t("notifications")}
                  {user.unread > 0 ? <span className="ml-auto rounded-full bg-lime px-2 text-xs font-semibold">{user.unread}</span> : null}
                </Link>
              </MenuItem>
              <form action={signOut}>
                <MenuItem asChild>
                  <button type="submit">
                    <LogOut size={18} aria-hidden="true" /> {t("signOut")}
                  </button>
                </MenuItem>
              </form>
            </MenuContent>
          </Menu>
        ) : (
          <Link
            href="/login"
            className={cn("mono-label link-anim hidden min-h-[44px] items-center rounded-full px-4 sm:flex", textColor)}
          >
            {t("signIn")}
          </Link>
        )}

        <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={t("menuOpen")}
              className={cn("icon-btn flex h-11 w-11 cursor-pointer items-center justify-center rounded-full md:hidden", textColor)}
            >
              <MenuIcon size={22} aria-hidden="true" />
            </button>
          </DialogTrigger>
          <DialogContent variant="drawer" title={t("menuTitle")} closeLabel={t("menuClose")}>
            <ul className="m-0 mt-10 flex list-none flex-col p-0">
              {drawerLinks.map((l) => (
                <li key={l.href}>
                  <DialogClose asChild>
                    <Link href={l.href} className="mono-label flex min-h-[48px] items-center rounded-2xl px-4 text-ink no-underline hover:bg-surface">
                      {l.label}
                    </Link>
                  </DialogClose>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-center border-t border-line pt-2">
              <LanguageSwitcher />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </motion.nav>
  );
}
