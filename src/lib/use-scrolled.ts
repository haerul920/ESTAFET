"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/** True once the page is scrolled further than `after` pixels. False on the server. */
export function useScrolled(after = 24): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > after,
    () => false,
  );
}
