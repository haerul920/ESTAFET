"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const START_EVENT = "estafet:navstart";
/** A bar that never finishes is worse than none: give up after this long. */
const MAX_MS = 12_000;

/** Starts the top bar from code (for example before a sign-out redirect). It stops on the next route change. */
export function startNavProgress() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(START_EVENT));
}

function isInternalNavigation(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || a.target === "_blank" || a.hasAttribute("download")) return false;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return false;
  // Same page (or only the hash changes): nothing loads.
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

/**
 * A thin bar at the very top while the next page loads, so every click gets instant feedback (CLAUDE.md 14.8:
 * transform and opacity only). Render it inside <Suspense> (it reads the search params). Decorative: `aria-hidden`, no pointer events, it covers nothing.
 */
export function NavProgress() {
  const route = usePathname() + "?" + useSearchParams().toString();
  // The route the bar was started on. Once the route changes, the new page is on screen and the bar is done.
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const routeRef = useRef(route);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = startedOn !== null && startedOn === route;

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    const start = () => {
      setStartedOn(routeRef.current);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setStartedOn(null), MAX_MS);
    };
    const onClick = (e: MouseEvent) => {
      if (isInternalNavigation(e)) start();
    };
    // Capture phase: Next.js <Link> calls preventDefault() on the click, so a bubbling listener would never see it.
    document.addEventListener("click", onClick, true);
    window.addEventListener(START_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START_EVENT, start);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-system-banner h-[3px] overflow-hidden"
    >
      <div
        className={
          active
            ? "nav-progress h-full w-full origin-left bg-blue opacity-100"
            : "h-full w-full origin-left scale-x-100 bg-blue opacity-0 transition-opacity duration-[250ms]"
        }
      />
    </div>
  );
}
