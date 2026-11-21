"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import * as RT from "@radix-ui/react-toast";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "error";
  undo?: () => Promise<{ error?: string }>;
}

interface ToastApi {
  push: (t: { message: string; tone?: "success" | "error"; undo?: () => Promise<{ error?: string }> }) => void;
}

export interface ToastLabels {
  undo: string;
  undone: string;
  dismiss: string;
  region: string;
}

const Ctx = createContext<ToastApi>({ push: () => undefined });
export const useToast = () => useContext(Ctx);

/**
 * Toasts on Radix: announced to screen readers, pause on hover and focus, swipe to dismiss. They sit above bottom
 * bars (safe area aware) at the toast layer. A toast can carry an Undo for reversible actions.
 * The admin area wraps its own provider with English labels.
 */
export function ToastProvider({ children, labels }: { children: React.ReactNode; labels?: ToastLabels }) {
  const t = useTranslations("ui");
  const L: ToastLabels = labels ?? {
    undo: t("undo"),
    undone: t("undone"),
    dismiss: t("dismiss"),
    region: t("notifications"),
  };
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: number) => setItems((cur) => cur.filter((x) => x.id !== id)), []);
  const push = useCallback<ToastApi["push"]>((x) => {
    const id = ++seq.current;
    setItems((cur) => [...cur, { id, message: x.message, tone: x.tone ?? "success", undo: x.undo }]);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      <RT.Provider swipeDirection="right" label={L.region}>
        {children}
        {items.map((x) => (
          <RT.Root
            key={x.id}
            type={x.tone === "error" ? "foreground" : "background"}
            duration={x.undo ? 10000 : x.tone === "error" ? 8000 : 5000}
            onOpenChange={(open) => !open && remove(x.id)}
            className={`o-toast flex items-start gap-3 rounded-2xl p-3.5 text-sm shadow-[0_12px_30px_rgba(10,26,38,0.25)] ${x.tone === "error" ? "bg-[#fdecea] text-danger" : "bg-black text-white"}`}
          >
            {x.tone === "error" ? (
              <TriangleAlert size={18} className="mt-0.5 flex-none" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={18} className="mt-0.5 flex-none text-lime" aria-hidden="true" />
            )}
            <RT.Description className="flex-1">{x.message}</RT.Description>
            {x.undo ? (
              <RT.Action
                altText={L.undo}
                className="cursor-pointer font-semibold text-lime underline"
                onClick={async () => {
                  const r = await x.undo!();
                  push(r.error ? { message: r.error, tone: "error" } : { message: L.undone });
                }}
              >
                {L.undo}
              </RT.Action>
            ) : null}
            <RT.Close
              aria-label={L.dismiss}
              className="icon-btn flex h-8 w-8 cursor-pointer items-center justify-center rounded-full opacity-70 hover:opacity-100"
            >
              <X size={16} aria-hidden="true" />
            </RT.Close>
          </RT.Root>
        ))}
        <RT.Viewport className="pointer-events-none fixed bottom-0 right-0 z-toast m-0 flex w-[min(380px,100vw)] list-none flex-col gap-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] outline-none [&>*]:pointer-events-auto" />
      </RT.Provider>
    </Ctx.Provider>
  );
}
