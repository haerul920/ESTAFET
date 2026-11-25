import { useTranslations } from "next-intl";
import { SiteNav } from "@/components/ui/SiteHeader";
import { Footer } from "@/components/ui/Footer";

/**
 * Full-layout skeleton for the home page (`/`).
 * Mirrors the Sky Hero + 3-column Handover Bento Showcase, the Why section,
 * the 4-card Product Stats Bento, the 4-step How It Works grid, and the Audience split.
 */
export default function Loading() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="text-[17px]">
      <span className="sr-only">{t("loadingPage")}</span>
      <section className="p-3">
        <div
          className="relative isolate overflow-hidden rounded-[36px] px-6 pt-5"
          style={{ background: "var(--sky-gradient)" }}
        >
          <SiteNav variant="hero" />
          {/* The same distances as the real hero: the headline wraps to three lines, then the lead, buttons and cards. */}
          <div
            aria-hidden="true"
            className="mx-auto mt-[84px] flex max-w-[860px] flex-col items-center max-md:mt-16 max-sm:mt-10"
          >
            <div className="mb-6 flex w-full flex-col items-center gap-3">
              {["w-[min(430px,80%)]", "w-[min(660px,96%)]", "w-[min(260px,50%)]"].map((w) => (
                <div key={w} className={`skeleton-sky h-[62px] rounded-2xl max-lg:h-12 max-md:h-9 ${w}`} />
              ))}
            </div>
            <div className="mb-9 flex w-full flex-col items-center gap-3">
              {["w-[min(540px,92%)]", "w-[min(520px,88%)]", "w-[min(380px,64%)]"].map((w) => (
                <div key={w} className={`skeleton-sky h-4 rounded-full ${w}`} />
              ))}
            </div>
            <div className="flex w-full flex-wrap justify-center gap-3 max-sm:flex-col">
              <div className="skeleton-sky h-[52px] w-44 rounded-full max-sm:w-full" />
              <div className="h-[52px] w-52 rounded-full bg-lime/80 max-sm:w-full" />
            </div>
          </div>

          <div aria-hidden="true" className="mx-auto mt-14 max-w-[1060px] pb-8 max-sm:mt-9">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
              <div className="flex min-h-[408px] flex-col justify-end rounded-[32px] border border-white/40 bg-white/15 p-5 max-sm:min-h-[260px]">
                <div className="rounded-3xl bg-white p-5">
                  <div className="skeleton-strong mb-4 h-14 w-32 rounded-xl" />
                  <div className="skeleton mb-2 h-3.5 w-full" />
                  <div className="skeleton mb-2 h-3.5 w-[88%]" />
                  <div className="skeleton h-3.5 w-[64%]" />
                </div>
              </div>
              <div className="flex min-h-[408px] flex-col justify-between rounded-[32px] bg-white/95 p-6 max-sm:min-h-[260px]">
                <div className="skeleton h-3.5 w-48 rounded-full" />
                <div className="flex flex-col gap-3">
                  <div className="skeleton-strong h-14 w-14 rounded-xl" />
                  <div className="flex gap-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="skeleton-strong h-6 w-6 rounded-full" />
                    ))}
                  </div>
                  <div className="skeleton h-3.5 w-[92%]" />
                  <div className="skeleton h-3.5 w-[76%]" />
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="min-h-[170px] flex-1 rounded-[32px] bg-lime p-6">
                  <div className="skeleton-strong mb-4 h-3.5 w-40 rounded-full" />
                  <div className="skeleton-strong mb-4 h-14 w-12 rounded-xl" />
                  <div className="skeleton-strong mb-2 h-3.5 w-full" />
                  <div className="skeleton-strong h-3.5 w-[70%]" />
                </div>
                <div className="h-[150px] rounded-[32px] bg-[#10151A]" />
              </div>
            </div>
          </div>

          <div aria-hidden="true" className="pb-10 pt-2 flex justify-center">
            <div className="skeleton-sky h-3.5 w-44 rounded-full" />
          </div>
        </div>
      </section>

      <div aria-hidden="true">
        <section className="mx-auto max-w-[1120px] px-8 pb-12 pt-24 text-center max-sm:px-4 max-sm:pt-16">
          <div className="skeleton mx-auto mb-7 h-4 w-36 rounded-full" />
          <div className="mx-auto flex max-w-[860px] flex-col items-center gap-3">
            <div className="skeleton h-12 w-[90%] rounded-2xl" />
            <div className="skeleton h-12 w-[82%] rounded-2xl" />
            <div className="skeleton h-12 w-[65%] rounded-2xl" />
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-8 pb-6 pt-[72px] max-sm:px-4">
          <div className="skeleton mb-4 h-4 w-28 rounded-full" />
          <div className="skeleton mb-8 h-11 w-[min(580px,90%)] rounded-2xl" />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton min-h-[230px] rounded-[28px]" />
            ))}
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
