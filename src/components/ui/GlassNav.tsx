"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { Bell, Flag, Loader2, LogOut, Menu as MenuIcon, LayoutDashboard, Settings, ShieldCheck } from "lucide-react";
import { LogoMark } from "./Logo";
import { ButtonLink } from "./Button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "./Dialog";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "./Menu";
import { signOut } from "@/app/actions/auth";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { startNavProgress } from "./NavProgress";
import { useScrolled } from "@/lib/use-scrolled";
import { iconMotion } from "@/components/ui/motion-presets";

export interface NavUser {
  name: string;
  initials: string;
  unread: number;
  /** Shows the link to the admin area. The area itself checks the role again on the server. */
  isAdmin: boolean;
  /** The address of their own profile photo, if they added one. */
  photo: string | null;
}

/**
 * Liquid glass navigation pill. `hero` sits on the saturated sky (white text),
 * `strip` sits on the light sky strip of inner pages (ink text).
 * The account menu and the phone drawer are Radix overlays rendered in portals, so nothing can cover them.
 */
export function GlassNav({ variant = "strip", user }: { variant?: "hero" | "strip"; user: NavUser | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  // Scrolled, the bar floats over anything, so it turns solid with dark text. White text and a see-through
  // bar are only readable on the sky at the top of the page.
  const scrolled = useScrolled();
  const hero = variant === "hero" && !scrolled;

  // Close the drawer when the route changes (state adjusted during render, not in an effect).
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setDrawerOpen(false);
  }

  function handleSignOut() {
    if (signingOut) return;
    startNavProgress();
    startSignOut(async () => {
      try {
        const supabase = createBrowserSupabase();
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        /* ignore browser sign-out error */
      }
      if (typeof document !== "undefined") {
        for (const part of document.cookie.split(";")) {
          const name = part.split("=")[0]?.trim();
          if (name && name.startsWith("sb-")) {
            document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
          }
        }
      }
      try {
        await signOut();
      } catch {
        /* NEXT_REDIRECT or network error */
      }
      router.replace("/");
      router.refresh();
    });
  }

  const textColor = hero ? "text-white" : "text-ink";
  // The dashboard is not here: signed-in people open it from the account menu.
  const links = [
    { href: "/", label: t("homeLink") },
    { href: "/explore", label: t("explore") },
  ];
  const drawerLinks = [
    ...links,
    { href: "/bagikan", label: t("share") },
    ...(user
      ? [
          ...(user.isAdmin ? [{ href: "/admin", label: t("admin") }] : []),
          { href: "/notifikasi", label: t("notifications"), badge: user.unread },
          { href: "/laporan-saya", label: t("myReports") },
          { href: "/akun/setelan", label: t("settings") },
        ]
      : [{ href: "/login", label: t("signIn") }]),
  ];

  return (
    <motion.nav
      aria-label={t("main")}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative z-nav mx-auto flex max-w-[1040px] items-center justify-between gap-3 rounded-full py-2.5 pl-[22px] pr-2.5",
        scrolled ? "glass glass-stuck" : hero ? "glass" : "glass glass-strong",
      )}
    >
      <Link href="/" aria-label={t("home")} className={cn("flex items-center gap-2.5 no-underline", textColor)}>
        <LogoMark size={27} onSky={hero} />
        <span className="sr-only">ESTAFET</span>
      </Link>

      <ul className="m-0 hidden list-none items-center gap-1 p-0 md:flex">
        {links.map((l) => {
          const exact = pathname === l.href;
          // A project page is part of Explore, so that tab stays lit while someone reads a project.
          const active =
            exact || pathname.startsWith(l.href + "/") || (l.href === "/explore" && pathname.startsWith("/projects/"));
          return (
            <li key={l.href} className="relative">
              <Link
                href={l.href}
                aria-current={exact ? "page" : active ? "true" : undefined}
                className={cn("mono-label link-anim relative z-raised block rounded-full px-4 py-[11px]", textColor)}
              >
                {l.label}
              </Link>
              {active ? (
                <motion.span
                  layoutId="nav-active"
                  className={cn(
                    "absolute inset-0 rounded-full",
                    hero ? "bg-white/25" : scrolled ? "bg-blue-tint" : "bg-white/85",
                  )}
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-2">
        <LanguageSwitcher tone={hero ? "light" : "dark"} className="hidden md:flex" />
        <ButtonLink href="/bagikan" size="sm" arrow className="hidden md:inline-flex">
          {t("share")}
        </ButtonLink>

        {user ? (
          <Menu>
            <MenuTrigger asChild>
              <motion.button
                {...iconMotion}
                type="button"
                aria-busy={signingOut || undefined}
                className="icon-press relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black text-[13px] font-semibold text-lime"
              >
                <span className="sr-only">
                  {t("account", { name: user.name })}
                  {user.unread > 0 ? t("accountUnread", { count: user.unread }) : ""}
                </span>
                {signingOut ? (
                  <Loader2 size={18} className="animate-spin text-lime" aria-hidden="true" />
                ) : user.photo ? (
                  // Private and already small, so it is shown as it is.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photo} alt="" width={44} height={44} className="h-11 w-11 rounded-full" />
                ) : (
                  <span aria-hidden="true">{user.initials}</span>
                )}
                {user.unread > 0 && !signingOut ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-lime px-1 text-[11px] font-bold text-black ring-2 ring-white"
                  >
                    {user.unread}
                  </span>
                ) : null}
              </motion.button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>{user.name}</MenuLabel>
              {user.isAdmin ? (
                <MenuItem asChild>
                  <Link href="/admin">
                    <ShieldCheck size={18} aria-hidden="true" /> {t("admin")}
                  </Link>
                </MenuItem>
              ) : null}
              <MenuItem asChild>
                <Link href="/dasbor">
                  <LayoutDashboard size={18} aria-hidden="true" /> {t("dashboard")}
                </Link>
              </MenuItem>
              <MenuItem asChild>
                <Link href="/notifikasi">
                  <Bell size={18} aria-hidden="true" /> {t("notifications")}
                  {user.unread > 0 ? (
                    <span className="ml-auto rounded-full bg-lime px-2 text-xs font-semibold">{user.unread}</span>
                  ) : null}
                </Link>
              </MenuItem>
              <MenuItem asChild>
                <Link href="/laporan-saya">
                  <Flag size={18} aria-hidden="true" /> {t("myReports")}
                </Link>
              </MenuItem>
              <MenuItem asChild>
                <Link href="/akun/setelan">
                  <Settings size={18} aria-hidden="true" /> {t("settings")}
                </Link>
              </MenuItem>
              <MenuItem
                disabled={signingOut}
                onSelect={(e) => {
                  e.preventDefault();
                  handleSignOut();
                }}
              >
                {signingOut ? (
                  <Loader2 size={18} className="animate-spin text-blue" aria-hidden="true" />
                ) : (
                  <LogOut size={18} aria-hidden="true" />
                )}{" "}
                {t("signOut")}
              </MenuItem>
            </MenuContent>
          </Menu>
        ) : (
          <Link
            href="/login"
            className={cn("mono-label link-anim hidden min-h-[44px] items-center rounded-full px-4 md:flex", textColor)}
          >
            {t("signIn")}
          </Link>
        )}

        <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DialogTrigger asChild>
            <motion.button
              {...iconMotion}
              type="button"
              aria-label={t("menuOpen")}
              className={cn(
                "icon-press flex h-11 w-11 cursor-pointer items-center justify-center rounded-full md:hidden",
                textColor,
              )}
            >
              <MenuIcon size={22} aria-hidden="true" />
            </motion.button>
          </DialogTrigger>
          <DialogContent variant="drawer" title={t("menuTitle")} closeLabel={t("menuClose")}>
            {user ? (
              <div className="mt-10 rounded-2xl bg-surface px-4 py-3 text-sm font-semibold text-ink">{user.name}</div>
            ) : null}
            <ul className={cn("m-0 flex list-none flex-col p-0", user ? "mt-2" : "mt-10")}>
              {drawerLinks.map((l) => (
                <li key={l.href}>
                  <DialogClose asChild>
                    <Link
                      href={l.href}
                      className="mono-label flex min-h-[48px] items-center justify-between rounded-2xl px-4 text-ink no-underline hover:bg-surface"
                    >
                      <span>{l.label}</span>
                      {"badge" in l && typeof l.badge === "number" && l.badge > 0 ? (
                        <span className="rounded-full bg-lime px-2 py-0.5 text-xs font-bold text-black">{l.badge}</span>
                      ) : null}
                    </Link>
                  </DialogClose>
                </li>
              ))}
              {user ? (
                <li>
                  <button
                    type="button"
                    disabled={signingOut}
                    onClick={handleSignOut}
                    className="mono-label flex min-h-[48px] w-full cursor-pointer items-center gap-2.5 rounded-2xl px-4 text-left text-danger hover:bg-surface disabled:opacity-60"
                  >
                    {signingOut ? (
                      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <LogOut size={18} aria-hidden="true" />
                    )}
                    {t("signOut")}
                  </button>
                </li>
              ) : null}
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
