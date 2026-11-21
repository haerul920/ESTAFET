import { Link } from "@/i18n/navigation";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatWita, relativeTime } from "@/lib/admin/time";

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "grey",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  tone?: "grey" | "warn" | "blue" | "ok" | "danger";
}) {
  const tones = {
    grey: "bg-surface",
    warn: "bg-warn-bg",
    blue: "bg-blue-tint",
    ok: "bg-ok-bg",
    danger: "bg-[#fdecea]",
  };
  const inner = (
    <>
      <span className="mono-label block text-[11px] text-text-2">{label}</span>
      <span className="mt-1.5 block text-[34px] font-medium leading-none tracking-[-0.03em]">{value}</span>
      {hint ? <span className="mt-1.5 block text-[13px] text-text-2">{hint}</span> : null}
    </>
  );
  const cls = cn(
    "block rounded-3xl p-4 text-ink no-underline",
    tones[tone],
    href && "transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5",
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

const PILL = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  info: "bg-blue-tint text-blue-dark",
  neutral: "bg-chip text-text-3",
  danger: "bg-[#fdecea] text-danger",
  lime: "bg-lime text-black",
} as const;

export function StatusPill({ tone = "neutral", children }: { tone?: keyof typeof PILL; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        PILL[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Maps common statuses to pill tones so every table reads the same way. */
export function toneFor(status: string): keyof typeof PILL {
  if (["ok", "published", "approved", "done", "resolved", "matched", "restored", "mock"].includes(status)) return "ok";
  if (["open", "pending", "in_review", "running", "queued", "unpublished", "partial"].includes(status)) return "warn";
  if (["hidden", "removed", "failed", "declined", "not_found", "suspended", "expired"].includes(status))
    return "danger";
  if (["accepted"].includes(status)) return "ok";
  if (["held"].includes(status)) return "warn";
  if (["live", "scheduled"].includes(status)) return "info";
  return "neutral";
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line-strong bg-white p-10 text-center">
      <Inbox size={30} className="text-text-2" aria-hidden="true" />
      <h2 className="m-0 text-lg">{title}</h2>
      {text ? <p className="m-0 max-w-sm text-sm text-text-2">{text}</p> : null}
      {action}
    </div>
  );
}

export function KeyValueList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="m-0 grid grid-cols-[minmax(110px,160px)_1fr] gap-x-4 gap-y-2.5 text-sm">
      {items.map((it) => (
        <div key={it.label} className="contents">
          <dt className="text-text-2">{it.label}</dt>
          <dd className="m-0 min-w-0 break-words">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Timeline({ items }: { items: { id: string; title: string; sub?: string; when?: string | null }[] }) {
  if (items.length === 0) return <p className="m-0 text-sm text-text-2">Nothing recorded yet.</p>;
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {items.map((it) => (
        <li key={it.id} className="relative flex gap-3 pl-0.5">
          <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full bg-blue" />
          <span className="min-w-0 text-sm">
            <strong>{it.title}</strong>
            {it.sub ? <span className="block text-text-2">{it.sub}</span> : null}
            {it.when ? <Time iso={it.when} /> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Relative time with the absolute WITA time in the tooltip. */
export function Time({ iso, className }: { iso: string | null | undefined; className?: string }) {
  if (!iso) return <span className={className}>—</span>;
  return (
    <time dateTime={iso} title={formatWita(iso)} className={cn("block text-[13px] text-text-2", className)}>
      {relativeTime(iso)}
    </time>
  );
}

export function PageHeader({ title, intro, actions }: { title: string; intro?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="m-0 text-[28px] font-medium">{title}</h1>
        {intro ? <p className="mb-0 mt-1 text-sm text-text-2">{intro}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
  action,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-3xl bg-surface p-5", className)}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="mono-label m-0 text-xs font-normal text-text-2">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
