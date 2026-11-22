"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

/** From/to date filter. Dates are interpreted in WITA. Saved in the URL. */
export function DateRange({ from, to }: { from?: string; to?: string }) {
  const t = useTranslations("admin.common");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  function set(key: "from" | "to", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 text-sm" role="group" aria-label={t("dateRange")}>
      <label className="flex items-center gap-2">
        {t("from")}{" "}
        <input
          type="date"
          value={from ?? ""}
          onChange={(e) => set("from", e.target.value)}
          className="min-h-[40px] rounded-xl border border-line-strong bg-white px-3"
        />
      </label>
      <label className="flex items-center gap-2">
        {t("to")}{" "}
        <input
          type="date"
          value={to ?? ""}
          onChange={(e) => set("to", e.target.value)}
          className="min-h-[40px] rounded-xl border border-line-strong bg-white px-3"
        />
      </label>
    </div>
  );
}
