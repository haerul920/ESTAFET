"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";

/**
 * App-wide motion plumbing: framer-motion respects prefers-reduced-motion, and looping CSS
 * animations pause while the tab is hidden (html[data-page-hidden], see motion.css).
 */
export function MotionRuntime({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      root.dataset.pageHidden = document.hidden ? "true" : "false";
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
