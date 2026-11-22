"use client";

import { useEffect } from "react";

/** Remembers, for one year and in this browser only, that the first-run screen was shown. It is a hint, not a role. */
export function MarkWelcomed() {
  useEffect(() => {
    document.cookie = "estafet_welcomed=1; path=/; max-age=31536000; samesite=lax";
  }, []);
  return null;
}
