import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui/PageShell";

/**
 * Full-layout skeleton for `/notifikasi`.
 * Matches the notifications header, unread badge, and notification cards.
 */
export default function Loading() {
  const t = useTranslations("common");
  return (
    <PageShell width={820}>
      <div role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t("loadingPage")}</span>
        <div aria-hidden="true" className="flex flex-col gap-6">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="skeleton h-10 w-52 rounded-2xl" />
              <div className="skeleton h-6 w-20 rounded-full" />
            </div>
            <div className="skeleton h-5 w-96 max-w-full rounded-full" />
          </div>

          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col gap-2 rounded-3xl border border-line-soft bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="skeleton h-5 w-80 max-w-[75%]" />
                  <div className="skeleton h-3.5 w-24" />
                </div>
                <div className="skeleton h-4 w-[65%]" />
                {i < 2 ? <div className="skeleton mt-1 h-6 w-16 rounded-full" /> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
