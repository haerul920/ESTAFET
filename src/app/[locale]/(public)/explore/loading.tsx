import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui/PageShell";

/**
 * Full-layout skeleton for `/explore`.
 * Matches the header, one row with search and the filters, the result count and three cards to a row.
 */
export default function Loading() {
  const t = useTranslations("explore");
  return (
    <PageShell width={1120}>
      <div role="status" aria-busy="true" aria-label={t("loading")}>
        <div aria-hidden="true">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="skeleton mb-2 h-10 w-64 rounded-2xl" />
              <div className="skeleton h-5 w-[min(520px,85vw)] rounded-full" />
            </div>
          </div>

          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                {[
                  "flex-[1_1_240px]",
                  "flex-[0_1_250px] max-md:flex-[1_1_100%]",
                  "flex-[0_1_150px] max-md:flex-[1_1_100%]",
                  "flex-[0_1_200px] max-md:flex-[1_1_100%]",
                ].map((size) => (
                  <div key={size} className={`flex flex-col gap-1.5 ${size}`}>
                    <div className="skeleton h-4 w-24" />
                    <div className="skeleton h-12 w-full rounded-[14px]" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-8">
              <section className="min-w-0 flex-[1_1_560px]">
                <div className="skeleton mb-4 h-4 w-36 rounded-full" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="flex flex-col justify-between gap-4 rounded-[28px] bg-surface p-6">
                      <div className="flex flex-col gap-2.5">
                        <div className="skeleton-strong h-4 w-32 rounded-full" />
                        <div className="skeleton-strong h-6 w-[88%]" />
                        <div className="skeleton-strong h-4 w-full" />
                        <div className="skeleton-strong h-4 w-[82%]" />
                      </div>
                      <div className="skeleton-strong h-6 w-40 rounded-full" />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
