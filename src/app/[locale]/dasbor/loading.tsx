import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui/PageShell";

/**
 * Full-layout skeleton for `/dasbor`.
 * Mirrors the dashboard header, the 3 colored stat tiles (decisions, drafts, sent requests),
 * "Proyek saya" cards, "Proyek yang dilanjutkan" cards, and the "Notifikasi" list.
 */
export default function Loading() {
  const t = useTranslations("wizard");
  return (
    <PageShell>
      <div role="status" aria-busy="true" aria-label={t("loadingDashboard")}>
        <div aria-hidden="true">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="skeleton mb-2 h-10 w-52 rounded-2xl" />
              <div className="skeleton h-5 w-80 max-w-full rounded-full" />
            </div>
          </div>

          <div className="flex flex-col gap-10">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
              <div className="rounded-[28px] bg-warn-bg/70 p-5">
                <div className="skeleton-strong h-9 w-12 rounded-xl" />
                <div className="skeleton-strong mt-3 h-4 w-44" />
              </div>
              <div className="rounded-[28px] bg-blue-tint/70 p-5">
                <div className="skeleton-strong h-9 w-12 rounded-xl" />
                <div className="skeleton-strong mt-3 h-4 w-40" />
              </div>
              <div className="rounded-[28px] bg-surface p-5">
                <div className="skeleton-strong h-9 w-12 rounded-xl" />
                <div className="skeleton-strong mt-3 h-4 w-48" />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="skeleton h-7 w-44 rounded-xl" />
                <div className="skeleton h-10 w-36 rounded-full" />
              </div>
              {[0, 1].map((i) => (
                <div key={i} className="flex flex-col gap-4 rounded-[28px] bg-surface p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="skeleton-strong h-6 w-72 max-w-full" />
                      <div className="flex items-center gap-2">
                        <div className="skeleton-strong h-6 w-24 rounded-full" />
                        <div className="skeleton-strong h-4 w-48 max-w-full" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {i === 0 ? <div className="skeleton-strong h-11 w-24 rounded-full" /> : null}
                      <div className="skeleton-strong h-11 w-32 rounded-full" />
                    </div>
                  </div>
                  {i === 1 ? <div className="skeleton-strong h-4 w-24" /> : null}
                  <div className="skeleton-strong h-11 w-full rounded-[14px]" />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="skeleton h-7 w-56 rounded-xl" />
                <div className="skeleton h-10 w-36 rounded-full" />
              </div>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] bg-surface p-6"
                >
                  <div className="flex flex-col gap-2">
                    <div className="skeleton-strong h-5 w-60 max-w-full" />
                    <div className="skeleton-strong h-4 w-44" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="skeleton-strong h-6 w-24 rounded-full" />
                    <div className="skeleton-strong h-10 w-32 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
