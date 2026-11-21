"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { reauthenticate } from "@/app/[locale]/admin/actions";

export interface ActionResult {
  ok?: boolean;
  error?: string;
  needsReauth?: boolean;
  /** Anything the caller wants to show afterwards (for example a new consent link). */
  data?: Record<string, unknown>;
}

const MIN_REASON = 15;

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
export function ReasonAction({
  label,
  tone = "outline",
  consequence,
  action,
  undo,
  typedPhrase,
  reasonLabel = "Reason (kept in the audit log)",
  successMessage,
  onDone,
  small,
  disabled,
  children,
}: Props) {
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

  const reasonOk = reason.trim().length >= MIN_REASON;
  const typedOk = !typedPhrase || typed.trim() === typedPhrase;

  function close() {
    setOpen(false);
    setError("");
    setNeedsReauth(false);
    setPassword("");
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
        undo: undo
          ? () =>
              undo.action(`Undo: ${label.toLowerCase()}. ${usedReason}`.slice(0, 300)).then((r) => {
                router.refresh();
                return r;
              })
          : undefined,
      });
      onDone?.(res.data);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            small ? "min-h-[36px] px-3.5 py-1.5 text-[13px]" : "min-h-[44px] px-5 py-2.5 text-[15px]",
            BTN[tone],
          )}
        >
          {label}
        </button>
      </DialogTrigger>
      <DialogContent title={label} showClose={false}>
        <div className="mt-2 rounded-2xl bg-surface p-3.5 text-sm text-text-3">
          <strong className="mb-1 block text-ink">What will happen</strong>
          {consequence}
        </div>
        {children ? <div className="mt-4 flex flex-col gap-3">{children}</div> : null}
        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor={`${id}-r`} className="text-sm font-semibold">
            {reasonLabel}
          </label>
          <textarea
            id={`${id}-r`}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full resize-y rounded-[14px] border border-line-strong bg-white px-3.5 py-3 text-base"
            aria-describedby={`${id}-c`}
          />
          <span id={`${id}-c`} className={cn("text-[13px]", reasonOk ? "text-ok" : "text-text-2")}>
            {reason.trim().length} of at least {MIN_REASON} characters
          </span>
        </div>
        {typedPhrase ? (
          <div className="mt-3 flex flex-col gap-1.5">
            <label htmlFor={`${id}-p`} className="text-sm font-semibold">
              Type <code className="font-code">{typedPhrase}</code> to confirm
            </label>
            <input
              id={`${id}-p`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="min-h-[44px] w-full rounded-[14px] border border-line-strong px-3.5 font-code"
            />
          </div>
        ) : null}
        {needsReauth ? (
          <div className="mt-3 flex flex-col gap-1.5 rounded-2xl bg-warn-bg p-3.5">
            <label htmlFor={`${id}-pw`} className="flex items-center gap-2 text-sm font-semibold text-warn-ink">
              <ShieldAlert size={16} aria-hidden="true" /> Confirm your password
            </label>
            <input
              id={`${id}-pw`}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-[44px] w-full rounded-[14px] border border-line-strong bg-white px-3.5"
            />
            <span className="text-[13px] text-warn-ink">Remembered for 15 minutes in this session.</span>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mb-0 mt-3 rounded-xl bg-[#fdecea] px-3.5 py-2.5 text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="min-h-[44px] cursor-pointer rounded-full border-[1.5px] border-line-strong bg-white px-5 font-semibold hover:bg-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!reasonOk || !typedOk || pending || (needsReauth && password.length === 0)}
            onClick={run}
            className={cn(
              "min-h-[44px] cursor-pointer rounded-full px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-50",
              tone === "danger" ? "bg-danger text-white" : "bg-lime text-black",
            )}
          >
            {pending ? "Working…" : needsReauth ? "Confirm and continue" : label}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
