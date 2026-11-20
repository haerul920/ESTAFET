"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "./Toast";
import { reauthenticate } from "@/app/admin/actions";

export interface ActionResult {
  ok?: boolean;
  error?: string;
  needsReauth?: boolean;
  /** Anything the caller wants to show afterwards (for example a new consent link). */
  data?: Record<string, unknown>;
}

export const MIN_REASON = 15;

interface Props {
  /** Button text and dialog title. */
  label: string;
  tone?: "primary" | "outline" | "danger";
  /** What will happen, shown in the dialog. */
  consequence: React.ReactNode;
  /** Runs the audited server action. */
  action: (reason: string) => Promise<ActionResult>;
  /** Reversible actions get an Undo toast. */
  undo?: { label?: string; action: (reason: string) => Promise<ActionResult> };
  /** Dangerous actions: the admin must type this phrase. */
  typedPhrase?: string;
  /** Skip the reason field (not for audited destructive actions). */
  reasonLabel?: string;
  successMessage?: string;
  onDone?: (data?: Record<string, unknown>) => void;
  small?: boolean;
  disabled?: boolean;
  /** Optional extra fields rendered above the reason (their state is the caller's). */
  children?: React.ReactNode;
}

const BTN: Record<NonNullable<Props["tone"]>, string> = {
  primary: "bg-lime text-black hover:brightness-95",
  outline: "border-[1.5px] border-line-strong bg-white text-ink hover:bg-surface",
  danger: "border-[1.5px] border-danger bg-white text-danger hover:bg-[#fdecea]",
};

/**
 * A button that opens a dialog requiring a reason (15+ characters), shows what will happen, optionally
 * asks for a typed phrase, and asks for the password when a recent re-authentication is needed.
 */
export function ReasonAction({ label, tone = "outline", consequence, action, undo, typedPhrase, reasonLabel = "Reason (kept in the audit log)", successMessage, onDone, small, disabled, children }: Props) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [needsReauth, setNeedsReauth] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const reasonOk = reason.trim().length >= MIN_REASON;
  const typedOk = !typedPhrase || typed.trim() === typedPhrase;

  useEffect(() => {
    if (!open) return;
    const first = dialogRef.current?.querySelector<HTMLElement>("textarea, input");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && dialogRef.current) {
        const f = [...dialogRef.current.querySelectorAll<HTMLElement>("button, textarea, input, [href]")].filter((el) => !el.hasAttribute("disabled"));
        if (f.length === 0) return;
        const a = f[0];
        const z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setError("");
    setNeedsReauth(false);
    setPassword("");
    // focus returns to the button that opened the dialog
    setTimeout(() => openerRef.current?.focus(), 0);
  }

  function run() {
    start(async () => {
      setError("");
      if (needsReauth) {
        const r = await reauthenticate(password);
        if (r.error) {
          setError(r.error);
          return;
        }
        setNeedsReauth(false);
        setPassword("");
      }
      const res = await action(reason.trim());
      if (res.needsReauth) {
        setNeedsReauth(true);
        setError("This action needs a recent password check. Enter your password to continue.");
        return;
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      const usedReason = reason.trim();
      setOpen(false);
      setReason("");
      setTyped("");
      toast.push({
        message: successMessage ?? `${label}: done.`,
        undo: undo ? () => undo.action(`Undo: ${label.toLowerCase()}. ${usedReason}`.slice(0, 300)).then((r) => { router.refresh(); return r; }) : undefined,
      });
      onDone?.(res.data);
      router.refresh();
      setTimeout(() => openerRef.current?.focus(), 0);
    });
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          small ? "min-h-[36px] px-3.5 py-1.5 text-[13px]" : "min-h-[44px] px-5 py-2.5 text-[15px]",
          BTN[tone],
        )}
      >
        {label}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${id}-t`}
              initial={{ y: 30, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              className="max-h-[90vh] w-full max-w-[520px] overflow-auto rounded-3xl bg-white p-6 shadow-[0_30px_80px_rgba(10,26,38,0.35)]"
            >
              <h2 id={`${id}-t`} className="m-0 text-xl">{label}</h2>
              <div className="mt-2 rounded-2xl bg-surface p-3.5 text-sm text-text-3">
                <strong className="mb-1 block text-ink">What will happen</strong>
                {consequence}
              </div>
              {children ? <div className="mt-4 flex flex-col gap-3">{children}</div> : null}
              <div className="mt-4 flex flex-col gap-1.5">
                <label htmlFor={`${id}-r`} className="text-sm font-semibold">{reasonLabel}</label>
                <textarea id={`${id}-r`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full resize-y rounded-[14px] border border-line-strong bg-white px-3.5 py-3 text-base" aria-describedby={`${id}-c`} />
                <span id={`${id}-c`} className={cn("text-[13px]", reasonOk ? "text-ok" : "text-text-2")}>
                  {reason.trim().length} of at least {MIN_REASON} characters
                </span>
              </div>
              {typedPhrase ? (
                <div className="mt-3 flex flex-col gap-1.5">
                  <label htmlFor={`${id}-p`} className="text-sm font-semibold">
                    Type <code className="font-code">{typedPhrase}</code> to confirm
                  </label>
                  <input id={`${id}-p`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="min-h-[44px] w-full rounded-[14px] border border-line-strong px-3.5 font-code" />
                </div>
              ) : null}
              {needsReauth ? (
                <div className="mt-3 flex flex-col gap-1.5 rounded-2xl bg-warn-bg p-3.5">
                  <label htmlFor={`${id}-pw`} className="flex items-center gap-2 text-sm font-semibold text-warn-ink">
                    <ShieldAlert size={16} aria-hidden="true" /> Confirm your password
                  </label>
                  <input id={`${id}-pw`} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="min-h-[44px] w-full rounded-[14px] border border-line-strong bg-white px-3.5" />
                  <span className="text-[13px] text-warn-ink">Remembered for 15 minutes in this session.</span>
                </div>
              ) : null}
              {error ? <p role="alert" className="mb-0 mt-3 rounded-xl bg-[#fdecea] px-3.5 py-2.5 text-sm font-semibold text-danger">{error}</p> : null}
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={close} className="min-h-[44px] cursor-pointer rounded-full border-[1.5px] border-line-strong bg-white px-5 font-semibold hover:bg-surface">Cancel</button>
                <button
                  type="button"
                  disabled={!reasonOk || !typedOk || pending || (needsReauth && password.length === 0)}
                  onClick={run}
                  className={cn("min-h-[44px] cursor-pointer rounded-full px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-50", tone === "danger" ? "bg-danger text-white" : "bg-lime text-black")}
                >
                  {pending ? "Working…" : needsReauth ? "Confirm and continue" : label}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
