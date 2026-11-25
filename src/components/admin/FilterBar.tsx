"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { SelectField } from "@/components/ui/Field";

export interface FilterGroup {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  /** The first choice of a dropdown, for example "All statuses". */
  allLabel?: string;
  /** Choices a dropdown shows only while a link has selected them, so they read properly. */
  linkOnly?: { value: string; label: string }[];
}

/** Search plus filter chips. Everything is saved in the URL (and resets to page 1 on change). */
export function FilterBar({
  searchLabel,
  filters = [],
  dropdowns = false,
}: {
  searchLabel?: string | null;
  filters?: FilterGroup[];
  /** One row: the search box and a dropdown per filter, as on the Explore page. Otherwise rows of chips. */
  dropdowns?: boolean;
}) {
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const label = searchLabel === undefined ? tc("search") : searchLabel;
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

  const active = ["q", ...filters.map((f) => f.key)].some((k) => params.has(k));

  return (
    <div className={cn("mb-4 flex flex-col gap-3", pending && "opacity-70")} role="search">
      <div className={cn("flex flex-wrap gap-3", dropdowns ? "items-end" : "items-center")}>
        {label ? (
          <div className={cn("relative min-w-[240px] flex-1", dropdowns && "self-end")}>
            <label htmlFor="admin-q" className="sr-only">
              {label}
            </label>
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2"
            />
            <input
              id="admin-q"
              type="search"
              value={q}
              placeholder={label}
              onChange={(e) => setQ(e.target.value)}
              className={cn(
                "w-full border border-line-strong bg-white py-2 pl-10 pr-4 text-[15px]",
                dropdowns ? "min-h-[48px] rounded-[14px]" : "min-h-[44px] rounded-full",
              )}
            />
          </div>
        ) : null}
        {dropdowns
          ? filters.map((f) => (
              <SelectField
                key={f.key}
                label={f.label}
                className="flex-[0_1_220px] max-md:flex-[1_1_100%]"
                value={params.get(f.key) ?? ""}
                onValueChange={(value) => set(f.key, value || null)}
                options={[
                  { value: "", label: f.allLabel ?? tc("all") },
                  ...f.options,
                  ...(f.linkOnly ?? []).filter((o) => o.value === params.get(f.key)),
                ]}
              />
            ))
          : null}
        {active ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              push(new URLSearchParams());
            }}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-blue hover:bg-blue-tint"
          >
            <X size={14} aria-hidden="true" /> {tc("clear")}
          </button>
        ) : null}
      </div>
      {(dropdowns ? [] : filters).map((f) => {
        const current = params.get(f.key);
        return (
          <div key={f.key} role="group" aria-label={f.label} className="flex flex-wrap items-center gap-2">
            <span className="mono-label text-[11px] text-text-2">{f.label}</span>
            {[{ value: "", label: tc("all") }, ...f.options].map((o) => {
              const on = (current ?? "") === o.value;
              return (
                <button
                  key={o.value || "all"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set(f.key, o.value || null)}
                  className={cn(
                    "min-h-[32px] cursor-pointer rounded-full border px-3 text-[13px] font-semibold transition-colors",
                    on ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink hover:bg-surface",
                  )}
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
