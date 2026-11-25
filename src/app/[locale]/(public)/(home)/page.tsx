import type { Metadata } from "next";
import { FileText, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { HomeHero } from "@/components/features/HomeHero";
import { SiteNav } from "@/components/ui/SiteHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Cloud, HoverLift, Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { Footer } from "@/components/ui/Footer";
import { MeadowCta } from "@/components/features/MeadowCta";
import { pageAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const m = await getTranslations({ locale, namespace: "meta" });
  return { title: t("meta.title"), description: m("description"), alternates: pageAlternates(locale, "/") };
}

const STEPS = [
  { n: 1, key: "s1", lime: false },
  { n: 2, key: "s2", lime: false },
  { n: 3, key: "s3", lime: true },
  { n: 4, key: "s4", lime: true },
] as const;

const GUARDS = ["g1", "g2", "g3"] as const;

function Eyebrow({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={`mono-label mb-4 ${center ? "mb-7" : ""}`}>
      <span className="mr-2.5 inline-block h-1.5 w-1.5 rounded-full bg-ink align-middle" />
      {children}
    </div>
  );
}

export default function HomePage() {
  const t = useTranslations("home");
  return (
    <div className="relative text-[17px]">
      {/* Sticks 12 px from the top. It starts 32 px down, on the sky, in the space the hero keeps free. */}
      <header className="sticky -top-5 z-nav h-0">
        <div className="px-9 pt-8 max-sm:px-7">
          <SiteNav variant="hero" />
        </div>
      </header>
      <main id="main">
        <HomeHero />

        <section className="mx-auto max-w-[1120px] px-8 pb-12 pt-24 text-center max-md:px-6 max-md:pt-16 max-sm:px-4 max-sm:pb-8 max-sm:pt-12">
          <Reveal>
            <Eyebrow center>{t("why.eyebrow")}</Eyebrow>
            <h2 className="mx-auto max-w-[900px] text-[56px] font-medium leading-[1.08] tracking-[-0.045em] max-lg:text-[44px] max-md:text-[34px] max-sm:text-[28px]">
              {t("why.a")}{" "}
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#4AA0F2] align-middle max-sm:h-8 max-sm:w-8">
                <FileText size={20} color="#fff" strokeWidth={2.2} aria-hidden="true" />
              </span>{" "}
              {t("why.b")}{" "}
              <span className="text-[#6F7881]">
                {t("why.c")}{" "}
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-lime align-middle max-sm:h-8 max-sm:w-8">
                  <ArrowRight size={20} color="#10151A" strokeWidth={2.2} aria-hidden="true" />
                </span>{" "}
                {t("why.d")}
              </span>
            </h2>
          </Reveal>
        </section>

        <section
          id="how"
          className="mx-auto max-w-[1120px] scroll-mt-8 px-8 pb-6 pt-[72px] max-md:px-6 max-sm:px-4 max-sm:pt-12"
        >
          <Reveal>
            <Eyebrow>{t("how.eyebrow")}</Eyebrow>
            <h2 className="mb-8 max-w-[680px] text-5xl font-medium leading-[1.08] tracking-[-0.04em] max-md:text-[34px] max-sm:mb-6 max-sm:text-[28px]">
              {t("how.title")}
            </h2>
          </Reveal>
          {/* 1, 2 or 4 columns, never 3 + 1: a lone last card made the row look uneven (QA note). */}
          <Stagger gap={0.1} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <StaggerItem
                key={s.n}
                // The label and text sit right under the number, so every card in a row starts its label at the same height
                // (QA note: with justify-between, a longer text pushed its label up and the row looked uneven).
                className="flex min-h-[230px] flex-col gap-8 rounded-[28px] bg-surface-soft p-6 max-sm:min-h-[190px] max-sm:gap-6 max-sm:rounded-[24px] max-sm:p-5"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${s.lime ? "bg-lime text-black" : "bg-black text-white"}`}
                >
                  {s.n}
                </div>
                <div>
                  <div className="mono-label mb-1.5 text-xs">{t(`how.${s.key}.title`)}</div>
                  <p className="m-0 text-base text-text-3">{t(`how.${s.key}.text`)}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <section className="mx-auto grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(min(360px,100%),1fr))] gap-4 px-8 pb-6 pt-10 max-md:px-6 max-sm:px-4">
          <Reveal>
            <HoverLift>
              <div
                className="relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-[36px] p-9 text-white max-sm:min-h-[310px] max-sm:rounded-[28px] max-sm:p-6"
                style={{ background: "linear-gradient(180deg,#1E7BE8 0%,#6BB1F6 100%)" }}
              >
                <Cloud className="-bottom-10 -right-20 h-[140px] w-[380px] opacity-55 blur-[28px]" />
                <span className="mono-label relative text-xs">{t("audience.owner.label")}</span>
                <div className="relative">
                  <h3 className="mb-3 text-4xl font-medium leading-[1.1] tracking-[-0.035em] max-md:text-[32px] max-sm:text-[26px]">
                    {t("audience.owner.title")}
                  </h3>
                  <p className="mb-6 max-w-[420px] text-white/95">{t("audience.owner.text")}</p>
                  <ButtonLink href="/bagikan" size="lg" arrow className="max-sm:w-full">
                    {t("audience.owner.cta")}
                  </ButtonLink>
                </div>
              </div>
            </HoverLift>
          </Reveal>
          <Reveal delay={0.1}>
            <HoverLift>
              <div className="flex min-h-[380px] flex-col justify-between rounded-[36px] bg-lime p-9 text-black max-sm:min-h-[310px] max-sm:rounded-[28px] max-sm:p-6">
                <span className="mono-label text-xs">{t("audience.next.label")}</span>
                <div>
                  <h3 className="mb-3 text-4xl font-medium leading-[1.1] tracking-[-0.035em] max-md:text-[32px] max-sm:text-[26px]">
                    {t("audience.next.title")}
                  </h3>
                  <p className="mb-6 max-w-[420px]">{t("audience.next.text")}</p>
                  <ButtonLink href="/explore" variant="darkSolid" size="lg" arrow className="max-sm:w-full">
                    {t("audience.next.cta")}
                  </ButtonLink>
                </div>
              </div>
            </HoverLift>
          </Reveal>
        </section>

        <section className="px-3 pb-3 pt-12">
          <div
            className="relative overflow-hidden rounded-[36px] px-8 py-14 max-sm:px-5"
            style={{ background: "linear-gradient(180deg,#2D86EE 0%,#8CC4F8 100%)" }}
          >
            <Cloud className="-left-20 top-10 h-[100px] w-[340px] opacity-50 blur-[26px]" />
            <Cloud className="-right-[60px] bottom-[30px] h-[110px] w-[380px] opacity-55 blur-[26px]" />
            <div className="relative mx-auto max-w-[1060px]">
              <Reveal>
                <div className="mono-label mb-3 text-white">{t("close.label")}</div>
                <h2 className="mb-8 text-5xl font-medium leading-[1.08] tracking-[-0.04em] text-white max-md:text-[34px]">
                  {t("close.title")}
                </h2>
              </Reveal>
              <Stagger gap={0.12} className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
                {GUARDS.map((g) => (
                  <StaggerItem key={g} className="glass rounded-[28px] p-6 text-[#08234D]">
                    <h3 className="mb-2 text-xl font-semibold tracking-normal">{t(`guards.${g}.title`)}</h3>
                    <p className="m-0 text-base">{t(`guards.${g}.text`)}</p>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </div>
        </section>

        <MeadowCta />
      </main>

      <div className="px-3 pb-3">
        <Footer />
      </div>
    </div>
  );
}
