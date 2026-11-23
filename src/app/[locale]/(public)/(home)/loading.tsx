import { useTranslations } from "next-intl";
import { SiteNav } from "@/components/ui/SiteHeader";

/**
 * Loading state of the home page. The page lives in its own route group, (home), so this boundary appears when
 * someone comes back to the home page from another public page (a loading.tsx in (public) would not, because that
 * segment does not change). Same sky panel and nav as the real hero, so nothing jumps when the page arrives.
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
          <div aria-hidden="true" className="mx-auto flex max-w-[900px] flex-col items-center gap-4 pb-24 pt-20">
            <div className="h-14 w-[min(720px,90%)] rounded-2xl bg-white/35" />
            <div className="h-14 w-[min(560px,75%)] rounded-2xl bg-white/35" />
            <div className="mt-2 h-5 w-[min(480px,80%)] rounded-full bg-white/30" />
            <div className="mt-6 flex gap-3">
              <div className="h-[52px] w-44 rounded-full bg-lime/70" />
              <div className="h-[52px] w-40 rounded-full bg-white/30" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
