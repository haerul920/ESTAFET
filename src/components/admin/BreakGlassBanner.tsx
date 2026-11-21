"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

/** Persistent red banner while an emergency (break glass) view is open. */
export function BreakGlassBanner({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(
      () => setLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(t);
  }, [expiresAt]);
  const mm = String(Math.floor(left / 60)).padStart(1, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div
      role="alert"
      className="z-system-banner relative -mx-4 -mt-6 mb-6 flex flex-wrap items-center justify-center gap-3 bg-danger px-4 py-2.5 text-sm font-semibold text-white"
    >
      <ShieldAlert size={18} aria-hidden="true" />
      <span>EMERGENCY ACCESS to private files. This view is logged and the creators were told.</span>
      <span className="font-code" aria-live="off">
        {left > 0 ? `Expires in ${mm}:${ss}` : "Expired"}
      </span>
    </div>
  );
}
