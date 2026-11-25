"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/** The attribute react-remove-scroll (used by Radix) puts on <body> while the page is locked. */
const SCROLL_LOCK = "data-scroll-locked";
const isPageLocked = () => document.body.hasAttribute(SCROLL_LOCK);

/**
 * App-wide motion & smooth scroll runtime:
 *  - Lenis provides smooth inertia scrolling synchronized with GSAP's ticker and ScrollTrigger. Areas that
 *    scroll on their own (dialogs, drawer, menus, lists, tables) keep native scrolling, and Lenis stops
 *    while a dialog or menu has locked the page.
 *  - Framer Motion (MotionConfig) respects prefers-reduced-motion across all interactive components.
 *  - Top route-progress bar gives immediate visual feedback when clicking links or submitting actions.
 *  - Looping CSS animations pause while the tab is hidden (html[data-page-hidden]).
 */
export function MotionRuntime({ children }: { children: React.ReactNode }) {
  const reduce = usePrefersReducedMotion();
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      root.dataset.pageHidden = document.hidden ? "true" : "false";
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const startProgress = () => {
      gsap.killTweensOf(bar);
      gsap.set(bar, { scaleX: 0.08, opacity: 1 });
      gsap.to(bar, { scaleX: 0.82, duration: 1.4, ease: "power2.out" });
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("/api/") ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self")
      )
        return;
      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
        startProgress();
      } catch {
        /* ignore malformed href */
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const bar = barRef.current;
    if (bar) {
      gsap.killTweensOf(bar);
      gsap.to(bar, {
        scaleX: 1,
        duration: 0.22,
        ease: "power2.out",
        onComplete: () => {
          gsap.to(bar, { opacity: 0, duration: 0.2, ease: "power1.out" });
        },
      });
    }
    // A new page: drop any scroll momentum left from the old one and measure the new height.
    const lenis = lenisRef.current;
    if (lenis && !isPageLocked()) {
      lenis.stop();
      lenis.start();
      lenis.resize();
    }
    const id = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  // Content that changes height (filters, tabs, streamed sections) moves the points where reveals start.
  // Without a refresh, a block could move into view and stay hidden until the next scroll.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let height = document.body.offsetHeight;
    const observer = new ResizeObserver(() => {
      if (document.body.offsetHeight === height) return;
      height = document.body.offsetHeight;
      clearTimeout(timer);
      timer = setTimeout(() => ScrollTrigger.refresh(), 150);
    });
    observer.observe(document.body);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (reduce) return;
    const root = document.documentElement;
    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      autoRaf: false,
      anchors: true,
      allowNestedScroll: true,
      stopInertiaOnNavigate: true,
    });
    lenisRef.current = lenis;

    root.classList.add("lenis", "lenis-smooth");
    lenis.on("scroll", ScrollTrigger.update);

    const onTick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    // Radix dialogs, the drawer and menus lock the page by marking <body>. Lenis scrolls by script, which the
    // lock cannot block, so it has to stop too. Areas that scroll on their own keep working while it is stopped.
    const syncLock = () => (isPageLocked() ? lenis.stop() : lenis.start());
    const lockObserver = new MutationObserver(syncLock);
    lockObserver.observe(document.body, { attributes: true, attributeFilter: [SCROLL_LOCK] });
    syncLock();

    return () => {
      lockObserver.disconnect();
      gsap.ticker.remove(onTick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      lenisRef.current = null;
      root.classList.remove("lenis", "lenis-smooth", "lenis-stopped");
    };
  }, [reduce]);

  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 400, damping: 28, mass: 0.7 }}>
      <div
        ref={barRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-system-banner h-[3px] origin-left scale-x-0 bg-gradient-to-r from-blue via-[#3C95F6] to-lime opacity-0"
      />
      {children}
    </MotionConfig>
  );
}
