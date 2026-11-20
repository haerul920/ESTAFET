import { CheckCircle2, FileSearch, ShieldCheck, FlaskConical } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "ok" | "info" | "warn" | "neutral" | "danger" | "lime";

const TONE: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok",
  info: "bg-blue-tint text-blue-dark",
  warn: "bg-warn-bg text-warn",
  neutral: "bg-chip text-text-3",
  danger: "bg-[#fdecea] text-danger",
  lime: "bg-lime text-black",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[13px] font-semibold",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Plain chip (tech tags, fields). */
export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("rounded-full bg-chip px-2.5 py-[3px] text-[13px]", className)}>{children}</span>;
}

export function CreatorVerified() {
  return (
    <Badge tone="ok">
      <ShieldCheck size={14} aria-hidden="true" />
      Creator-verified
    </Badge>
  );
}

export function AdvisorConsented() {
  return (
    <Badge tone="info">
      <CheckCircle2 size={14} aria-hidden="true" />
      Advisor-consented
    </Badge>
  );
}

export function DemoBadge({ children = "Demo data" }: { children?: React.ReactNode }) {
  return (
    <Badge tone="warn">
      <FlaskConical size={14} aria-hidden="true" />
      {children}
    </Badge>
  );
}

export function EvidenceChip({ status, detail }: { status: "matched" | "not_found" | "partial"; detail?: string }) {
  const ok = status === "matched";
  const partial = status === "partial";
  return (
    <Badge tone={ok ? "ok" : "warn"} className="self-start">
      <FileSearch size={14} aria-hidden="true" />
      {ok ? "Evidence matched" : partial ? "Evidence partly matched" : "Evidence not found"}
      {detail ? <span className="font-normal">{ok || partial ? " · " : " in "}{detail}</span> : null}
    </Badge>
  );
}
