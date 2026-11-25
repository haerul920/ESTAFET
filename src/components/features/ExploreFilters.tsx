"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { filterYears } from "@/lib/explore";
import { FACULTIES } from "@/lib/labels";
import { useLabels } from "@/lib/use-labels";
import { SearchableSelect } from "@/components/ui/Field";

/** Search, faculty, year and access. Everything lives in the URL so results can be shared. */
export function ExploreFilters({ resultCount, children }: { resultCount: number; children: React.ReactNode }) {
  const t = useTranslations("explore");
  // The faculty picker is the one from sign-up, so it uses the same search texts.
  const ta = useTranslations("auth");
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

  const active = ["q", "faculty", "year", "access"].some((k) => params.has(k));

  return (
    <div className="flex flex-col gap-6">
      {/* Search and the filters share one row, so the results below can use the whole width. */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
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
        <SearchableSelect
          label={t("legendFaculty")}
          name="faculty"
          className="flex-[0_1_250px] max-md:flex-[1_1_100%]"
          value={params.get("faculty") ?? ""}
          onValueChange={(value) => setSingle("faculty", value)}
          options={[
            { value: "", label: t("allFaculties") },
            ...FACULTIES.map((f) => ({ value: f, label: L.faculty(f) })),
          ]}
          searchPlaceholder={ta("facultySearchPlaceholder")}
          clearLabel={ta("facultySearchClear")}
          emptyText={ta("facultyEmpty")}
        />
        <SearchableSelect
          label={t("year")}
          name="year"
          className="flex-[0_1_150px] max-md:flex-[1_1_100%]"
          value={params.get("year") ?? ""}
          onValueChange={(value) => setSingle("year", value)}
          options={[
            { value: "", label: t("allYears") },
            ...filterYears(new Date().getFullYear()).map((y) => ({ value: String(y), label: String(y) })),
          ]}
          searchPlaceholder={t("searchYear")}
          clearLabel={ta("facultySearchClear")}
          emptyText={t("noYear")}
        />
        <SearchableSelect
          label={t("access")}
          name="access"
          className="flex-[0_1_200px] max-md:flex-[1_1_100%]"
          value={params.get("access") ?? ""}
          onValueChange={(value) => setSingle("access", value)}
          options={[
            { value: "", label: t("allAccess") },
            { value: "open", label: t("accessOpen") },
            { value: "by_request", label: t("accessApproval") },
          ]}
          searchPlaceholder={t("searchAccess")}
          clearLabel={ta("facultySearchClear")}
          emptyText={t("noAccess")}
        />
      </div>

      <section aria-label={t("results")} className="min-w-0" aria-busy={pending}>
        <div className="mb-4 flex min-h-[44px] flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-sm text-text-2" aria-live="polite">
            {pending ? t("updating") : t("count", { count: resultCount })}
          </p>
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
        </div>
        <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>{children}</div>
      </section>
    </div>
  );
}
