"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface FilterGroup {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/** Search plus filter chips. Everything is saved in the URL (and resets to page 1 on change). */
export function FilterBar({ searchLabel = "Search", filters = [], toggles = [] }: { searchLabel?: string | null; filters?: FilterGroup[]; toggles?: { key: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function push(next: URLSearchParams) {
    next.delete("page");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  function set(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  }

  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => set("q", q.trim() || null), 300);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = ["q", ...filters.map((f) => f.key), ...toggles.map((t) => t.key)].some((k) => params.has(k));

  return (
    <div className={cn("mb-4 flex flex-col gap-3", pending && "opacity-70")} role="search">
      <div className="flex flex-wrap items-center gap-3">
        {searchLabel ? (
          <div className="relative min-w-[240px] flex-1">
            <label htmlFor="admin-q" className="sr-only">
              {searchLabel}
            </label>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2" />
            <input id="admin-q" type="search" value={q} placeholder={searchLabel} onChange={(e) => setQ(e.target.value)} className="min-h-[44px] w-full rounded-full border border-line-strong bg-white py-2 pl-10 pr-4 text-[15px]" />
          </div>
        ) : null}
        {toggles.map((t) => (
          <label key={t.key} className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={params.get(t.key) === "1"} onChange={(e) => set(t.key, e.target.checked ? "1" : null)} className="h-[18px] w-[18px] accent-[#1760d6]" />
            {t.label}
          </label>
        ))}
        {active ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              push(new URLSearchParams());
            }}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-blue hover:bg-blue-tint"
          >
            <X size={14} aria-hidden="true" /> Clear
          </button>
        ) : null}
      </div>
      {filters.map((f) => {
        const current = params.get(f.key);
        return (
          <div key={f.key} role="group" aria-label={f.label} className="flex flex-wrap items-center gap-2">
            <span className="mono-label text-[11px] text-text-2">{f.label}</span>
            {[{ value: "", label: "All" }, ...f.options].map((o) => {
              const on = (current ?? "") === o.value;
              return (
                <button
                  key={o.value || "all"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set(f.key, o.value || null)}
                  className={cn("min-h-[32px] cursor-pointer rounded-full border px-3 text-[13px] font-semibold transition-colors", on ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink hover:bg-surface")}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
