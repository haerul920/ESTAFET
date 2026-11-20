"use client";

import { MotionConfig } from "framer-motion";

/** Respects prefers-reduced-motion for every framer-motion animation in the app. */
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
