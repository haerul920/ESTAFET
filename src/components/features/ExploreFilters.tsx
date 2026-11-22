"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { EXPLORE_FACULTIES } from "@/lib/labels";
import { useLabels } from "@/lib/use-labels";
import { SelectField } from "@/components/ui/Field";
import type { ProjectKind, StopReason } from "@/lib/db/types";

const KINDS: ProjectKind[] = ["student_program", "hackathon", "research"];
const REASONS: StopReason[] = ["funding_not_granted", "team_graduated", "time_or_people"];

/** Search, sort and checkbox filters. Everything lives in the URL so results can be shared. */
export function ExploreFilters({ resultCount, children }: { resultCount: number; children: React.ReactNode }) {
  const t = useTranslations("explore");
  const L = useLabels();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function push(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function setMulti(key: string, value: string, on: boolean) {
    const next = new URLSearchParams(params.toString());
    const current = next.getAll(key).filter((v) => v !== value);
    next.delete(key);
    for (const v of on ? [...current, value] : current) next.append(key, v);
    push(next);
  }

  function setSingle(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  }

  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSingle("q", q.trim()), 300);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = ["q", "kind", "reason", "faculty"].some((k) => params.has(k));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-[1_1_320px] flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-semibold">
            {t("search")}
          </label>
          <div className="relative">
            <Search
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2"
            />
            <input
              id="q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="min-h-[48px] w-full rounded-[14px] border border-line-strong bg-white py-3 pl-10 pr-3.5"
            />
          </div>
        </div>
        <SelectField
          label={t("sort")}
          className="flex-[0_1_220px]"
          value={params.get("sort") ?? "recent"}
          onChange={(e) => setSingle("sort", e.target.value === "recent" ? "" : e.target.value)}
        >
          <option value="recent">{t("sortRecent")}</option>
          <option value="tasks">{t("sortTasks")}</option>
          <option value="progress">{t("sortProgress")}</option>
        </SelectField>
      </div>

      <div className="flex flex-wrap items-start gap-8">
        <aside aria-label={t("filters")} className="flex flex-[0_0_240px] flex-col gap-6 max-md:flex-[1_1_100%]">
          <FilterGroup
            legend={t("legendKind")}
            name="kind"
            options={KINDS.map((k) => ({ value: k, label: L.kind[k] }))}
            selected={params.getAll("kind")}
            onToggle={setMulti}
          />
          <FilterGroup
            legend={t("legendReason")}
            name="reason"
            options={REASONS.map((r) => ({ value: r, label: L.stopReason[r] }))}
            selected={params.getAll("reason")}
            onToggle={setMulti}
          />
          <FilterGroup
            legend={t("legendFaculty")}
            name="faculty"
            options={EXPLORE_FACULTIES.map((f) => ({ value: f, label: L.faculty(f) }))}
            selected={params.getAll("faculty")}
            onToggle={setMulti}
          />
          {active ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                push(new URLSearchParams());
              }}
              className="flex min-h-[44px] w-fit cursor-pointer items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 text-sm font-semibold hover:bg-surface"
            >
              <X size={16} aria-hidden="true" /> {t("clear")}
            </button>
          ) : null}
        </aside>
        <section aria-label={t("results")} className="min-w-0 flex-[1_1_560px]" aria-busy={pending}>
          <p className="mb-4 mt-0 text-sm text-text-2" aria-live="polite">
            {pending ? t("updating") : t("count", { count: resultCount })}
          </p>
          <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>{children}</div>
        </section>
      </div>
    </div>
  );
}

function FilterGroup({
  legend,
  name,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (key: string, value: string, on: boolean) => void;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-2 p-0 font-semibold">{legend}</legend>
      <div className="flex flex-col gap-2">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-[44px] cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              className="h-[18px] w-[18px] accent-[#1760d6]"
              checked={selected.includes(o.value)}
              onChange={(e) => onToggle(name, o.value, e.target.checked)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
