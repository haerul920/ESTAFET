"use client";

import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { SurveyDots } from "@/components/features/SurveyDots";
import { Cloud, CountUp, ParallaxLayer, Stagger, StaggerItem, WordReveal } from "@/components/ui/motion";

export function HomeHero() {
  const t = useTranslations("home.hero");
  const ts = useTranslations("home.stats");
  return (
    <section className="p-3">
      <div
        className="relative isolate overflow-hidden rounded-[36px] px-6 pt-5 max-sm:px-4"
        style={{ background: "var(--sky-gradient)" }}
      >
        <ParallaxLayer>
          <Cloud
            className="-left-[60px] top-[360px] h-[90px] w-[320px] opacity-55 blur-[24px] max-sm:hidden"
            drift={70}
            duration={52}
            depth={0.6}
          />
          <Cloud
            className="-right-10 top-[240px] h-20 w-[300px] opacity-45 blur-[24px] max-sm:hidden"
            drift={60}
            duration={64}
            delay={20}
            depth={0.5}
          />
          <Cloud
            className="-left-[120px] bottom-5 h-[210px] w-[560px] opacity-95 blur-[30px]"
            drift={80}
            duration={58}
            delay={8}
            depth={1}
          />
          <Cloud
            className="-right-[100px] bottom-0 h-[230px] w-[620px] opacity-95 blur-[30px]"
            drift={70}
            duration={68}
            delay={30}
            depth={0.8}
          />
          <Cloud
            className="bottom-[-70px] left-[30%] h-[170px] w-[640px] opacity-95 blur-[28px]"
            drift={50}
            duration={46}
            delay={14}
            depth={0.9}
          />
        </ParallaxLayer>

        {/* Room for the navigation, which the page lays over this spot so that <main> starts after it. */}
        <div aria-hidden="true" className="h-[66px]" />

        <div className="relative z-raised mx-auto mt-[84px] max-w-[860px] text-center max-md:mt-16 max-sm:mt-10">
          <h1 className="mb-6 text-[72px] font-medium leading-[1.02] tracking-[-0.045em] text-white max-lg:text-[56px] max-md:text-[44px] max-sm:text-[34px]">
            <WordReveal text={t("line1")} className="block" baseDelay={100} />
            <WordReveal text={t("line2")} className="block text-[#EAF4FF]" baseDelay={420} />
          </h1>
          <p
            className="fade-up mx-auto mb-9 max-w-[560px] text-lg text-white/95 max-sm:mb-7 max-sm:text-base"
            style={{ "--delay": "500ms" } as React.CSSProperties}
          >
            {t("lead")}
          </p>
          <div
            className="fade-up flex flex-wrap justify-center gap-3 max-sm:flex-col max-sm:items-stretch"
            style={{ "--delay": "650ms" } as React.CSSProperties}
          >
            <ButtonLink href="/explore" variant="dark" size="lg" glow className="max-sm:w-full">
              {t("explore")}
            </ButtonLink>
            <ButtonLink href="/bagikan" size="lg" arrow glow className="max-sm:w-full">
              {t("share")}
            </ButtonLink>
          </div>
        </div>

        <div className="relative z-raised mx-auto mt-14 max-w-[1060px] pb-8 max-sm:mt-9">
          <Stagger gap={0.12} className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
            <StaggerItem>
              <div
                className="relative flex h-full min-h-[360px] flex-col justify-between overflow-hidden rounded-[32px] border border-white/40 p-5 shadow-[0_18px_40px_rgba(10,55,135,0.16)] max-sm:min-h-[260px] max-sm:rounded-[26px]"
                style={{ background: "linear-gradient(180deg,#2C86EE 0%,#7BBAF7 70%,#CDE4FB 100%)" }}
              >
                <Cloud className="-right-[60px] bottom-[100px] h-20 w-[260px] opacity-60 blur-[22px]" />
                <span className="mono-label relative text-xs text-white">{ts("surveyLabel")}</span>
                <div className="relative rounded-3xl bg-white p-5 max-sm:p-4">
                  <div className="text-[60px] font-medium leading-none tracking-[-0.05em] text-ink max-sm:text-[46px]">
                    <CountUp to={100} suffix="%" />
                  </div>
                  <p className="mt-2 text-[15px] text-text-2">{ts("surveyText")}</p>
                </div>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="flex h-full min-h-[360px] flex-col justify-between rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_18px_40px_rgba(10,55,135,0.16)] backdrop-blur-md max-sm:min-h-[260px] max-sm:rounded-[26px] max-sm:p-5">
                <span className="mono-label text-xs text-text-2">{ts("filesLabel")}</span>
                <div>
                  <div className="mb-4 text-[60px] font-medium leading-none tracking-[-0.05em] text-ink max-sm:mb-3 max-sm:text-[46px]">
                    <CountUp to={5} />
                  </div>
                  <SurveyDots filled={5} total={5} />
                  <p className="mt-3 text-[15px] text-text-2">{ts("filesText")}</p>
                </div>
              </div>
            </StaggerItem>
            <StaggerItem className="flex flex-col gap-4">
              <div className="flex min-h-[170px] flex-1 flex-col justify-between rounded-[32px] bg-lime p-6 text-ink shadow-[0_18px_40px_rgba(10,55,135,0.16)] max-sm:rounded-[26px] max-sm:p-5">
                <span className="mono-label text-xs">{ts("docsLabel")}</span>
                <div>
                  <div className="text-[52px] font-medium leading-none tracking-[-0.05em] max-sm:text-[42px]">
                    <CountUp to={3} />
                  </div>
                  <p className="mt-1.5 text-[15px]">{ts("docsText")}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[32px] bg-black p-6 text-white shadow-[0_18px_40px_rgba(10,55,135,0.16)] max-sm:rounded-[26px] max-sm:p-5">
                <div>
                  <span className="mono-label text-xs text-[#B8C0C8]">{ts("targetLabel")}</span>
                  <div className="mt-1 text-[15px] text-[#DDE2E6]">{ts("targetText")}</div>
                </div>
                <div className="whitespace-nowrap text-[40px] font-medium tracking-[-0.04em] max-sm:text-[32px]">
                  {ts("targetValue")}
                </div>
              </div>
            </StaggerItem>
          </Stagger>
        </div>

        <p className="mono-label relative z-raised mt-2 pb-10 text-center text-xs text-[#0E3A7A]">{t("stack")}</p>
      </div>
    </section>
  );
}
