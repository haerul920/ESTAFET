"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";

interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "error";
  undo?: () => Promise<{ error?: string }>;
}

interface ToastApi {
  push: (t: { message: string; tone?: "success" | "error"; undo?: () => Promise<{ error?: string }> }) => void;
}

const Ctx = createContext<ToastApi>({ push: () => undefined });
export const useToast = () => useContext(Ctx);

/** Consistent toasts for the admin area. A toast can carry an Undo for reversible actions. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: number) => setItems((cur) => cur.filter((t) => t.id !== id)), []);
  const push = useCallback<ToastApi["push"]>(
    (t) => {
      const id = ++seq.current;
      setItems((cur) => [...cur, { id, message: t.message, tone: t.tone ?? "success", undo: t.undo }]);
      setTimeout(() => remove(id), t.undo ? 10000 : 5000);
    },
    [remove],
  );

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl p-3.5 text-sm shadow-[0_12px_30px_rgba(10,26,38,0.25)] ${t.tone === "error" ? "bg-[#fdecea] text-danger" : "bg-black text-white"}`}
            >
              {t.tone === "error" ? <TriangleAlert size={18} className="mt-0.5 flex-none" aria-hidden="true" /> : <CheckCircle2 size={18} className="mt-0.5 flex-none text-lime" aria-hidden="true" />}
              <span className="flex-1">{t.message}</span>
              {t.undo ? (
                <button
                  type="button"
                  className="cursor-pointer font-semibold text-lime underline"
                  onClick={async () => {
                    remove(t.id);
                    const r = await t.undo!();
                    push(r.error ? { message: r.error, tone: "error" } : { message: "Undone." });
                  }}
                >
                  Undo
                </button>
              ) : null}
              <button type="button" aria-label="Dismiss" className="cursor-pointer opacity-70 hover:opacity-100" onClick={() => remove(t.id)}>
                <X size={16} aria-hidden="true" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
