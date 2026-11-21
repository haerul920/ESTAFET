import type { Metadata } from "next";
import { FileText, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { HomeHero } from "@/components/features/HomeHero";
import { SiteNav } from "@/components/ui/SiteHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Cloud, CountUp, Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { Footer } from "@/components/ui/Footer";
import { MeadowCta } from "@/components/features/MeadowCta";
import { SurveyDots } from "@/components/features/SurveyDots";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const m = await getTranslations({ locale, namespace: "meta" });
  return { title: t("meta.title"), description: m("description") };
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
    <div className="text-[17px]">
      <HomeHero nav={<SiteNav variant="hero" />} />

      <section className="mx-auto max-w-[1120px] px-8 pb-12 pt-24 text-center max-sm:px-4 max-sm:pt-16">
        <Reveal>
          <Eyebrow center>{t("why.eyebrow")}</Eyebrow>
          <h2 className="mx-auto max-w-[900px] text-[56px] font-medium leading-[1.08] tracking-[-0.045em] max-md:text-[36px]">
            {t("why.a")}{" "}
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#4AA0F2] align-middle">
              <FileText size={22} color="#fff" strokeWidth={2.2} aria-hidden="true" />
            </span>{" "}
            {t("why.b")}{" "}
            <span className="text-[#6F7881]">
              {t("why.c")}{" "}
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-lime align-middle">
                <ArrowRight size={22} color="#10151A" strokeWidth={2.2} aria-hidden="true" />
              </span>{" "}
              {t("why.d")}
            </span>
          </h2>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1120px] px-8 pb-6 pt-4 max-sm:px-4">
        <Stagger gap={0.12} className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4">
          <StaggerItem>
            <div
              className="relative flex min-h-[360px] flex-col justify-between overflow-hidden rounded-[32px] p-5"
              style={{ background: "linear-gradient(180deg,#2C86EE 0%,#7BBAF7 70%,#CDE4FB 100%)" }}
            >
              <Cloud className="-right-[60px] bottom-[100px] h-20 w-[260px] opacity-60 blur-[22px]" drift={14} />
              <span className="mono-label relative text-xs text-white">{t("stats.surveyLabel")}</span>
              <div className="relative rounded-3xl bg-white p-5">
                <div className="text-[60px] font-medium leading-none tracking-[-0.05em]">
                  <CountUp to={60} suffix="%" />
                </div>
                <p className="mt-2 text-[15px] text-text-2">{t("stats.surveyText")}</p>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="flex min-h-[360px] flex-col justify-between rounded-[32px] bg-surface-grey p-6">
              <span className="mono-label text-xs text-text-2">{t("stats.filesLabel")}</span>
              <div>
                <div className="mb-4 text-[60px] font-medium leading-none tracking-[-0.05em]">
                  <CountUp to={90} suffix="%" />
                </div>
                <SurveyDots filled={9} total={10} />
                <p className="mt-3 text-[15px] text-text-2">
                  {t("stats.filesText")}
                </p>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem className="flex flex-col gap-4">
            <div className="flex min-h-[170px] flex-1 flex-col justify-between rounded-[32px] bg-lime p-6">
              <span className="mono-label text-xs">{t("stats.docsLabel")}</span>
              <div>
                <div className="text-[52px] font-medium leading-none tracking-[-0.05em]">
                  <CountUp to={70} suffix="%" />
                </div>
                <p className="mt-1.5 text-[15px]">{t("stats.docsText")}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[32px] bg-black p-6 text-white">
              <div>
                <span className="mono-label text-xs text-[#B8C0C8]">{t("stats.targetLabel")}</span>
                <div className="mt-1 text-[15px] text-[#DDE2E6]">{t("stats.targetText")}</div>
              </div>
              <div className="whitespace-nowrap text-[40px] font-medium tracking-[-0.04em]">{t("stats.targetValue")}</div>
            </div>
          </StaggerItem>
        </Stagger>
        <p className="mx-1 mt-4 text-[13px] text-muted">
          {t("stats.source")}
        </p>
      </section>

      <section id="how" className="mx-auto max-w-[1120px] scroll-mt-8 px-8 pb-6 pt-[72px] max-sm:px-4">
        <Reveal>
          <Eyebrow>{t("how.eyebrow")}</Eyebrow>
          <h2 className="mb-8 max-w-[680px] text-5xl font-medium leading-[1.08] tracking-[-0.04em] max-md:text-[34px]">
            {t("how.title")}
          </h2>
        </Reveal>
        <Stagger gap={0.1} className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
          {STEPS.map((s) => (
            <StaggerItem key={s.n} className="flex min-h-[230px] flex-col justify-between rounded-[28px] bg-surface-soft p-6">
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

      <section className="mx-auto grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-4 px-8 pb-6 pt-10 max-sm:px-4">
        <Reveal>
          <div
            className="relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-[36px] p-9 text-white max-sm:p-6"
            style={{ background: "linear-gradient(180deg,#1E7BE8 0%,#6BB1F6 100%)" }}
          >
            <Cloud className="-bottom-10 -right-20 h-[140px] w-[380px] opacity-55 blur-[28px]" drift={20} />
            <span className="mono-label relative text-xs">{t("audience.owner.label")}</span>
            <div className="relative">
              <h3 className="mb-3 text-4xl font-medium leading-[1.1] tracking-[-0.035em] max-sm:text-[28px]">
                {t("audience.owner.title")}
              </h3>
              <p className="mb-6 max-w-[420px] text-white/95">
                {t("audience.owner.text")}
              </p>
              <ButtonLink href="/share" size="lg" arrow>
                {t("audience.owner.cta")}
              </ButtonLink>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="flex min-h-[380px] flex-col justify-between rounded-[36px] bg-lime p-9 text-black max-sm:p-6">
            <span className="mono-label text-xs">{t("audience.next.label")}</span>
            <div>
              <h3 className="mb-3 text-4xl font-medium leading-[1.1] tracking-[-0.035em] max-sm:text-[28px]">
                {t("audience.next.title")}
              </h3>
              <p className="mb-6 max-w-[420px]">
                {t("audience.next.text")}
              </p>
              <ButtonLink href="/explore" variant="darkSolid" size="lg" arrow>
                {t("audience.next.cta")}
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="px-3 pb-3 pt-12">
        <div
          className="relative overflow-hidden rounded-[36px] px-8 py-14 max-sm:px-5"
          style={{ background: "linear-gradient(180deg,#2D86EE 0%,#8CC4F8 100%)" }}
        >
          <Cloud className="-left-20 top-10 h-[100px] w-[340px] opacity-50 blur-[26px]" drift={24} />
          <Cloud className="-right-[60px] bottom-[30px] h-[110px] w-[380px] opacity-55 blur-[26px]" drift={-24} />
          <div className="relative mx-auto max-w-[1060px]">
            <Reveal>
              <div className="mono-label mb-3 text-white">{t("close.label")}</div>
              <h2 className="mb-8 text-5xl font-medium leading-[1.08] tracking-[-0.04em] text-white max-md:text-[34px]">
                {t("close.title")}
              </h2>
            </Reveal>
            <Stagger gap={0.12} className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
              {GUARDS.map((g) => (
                <StaggerItem
                  key={g}
                  className="glass rounded-[28px] p-6 text-[#08234D]"
                >
                  <h3 className="mb-2 text-xl font-semibold tracking-normal">{t(`guards.${g}.title`)}</h3>
                  <p className="m-0 text-base">{t(`guards.${g}.text`)}</p>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      <MeadowCta />

      <div className="px-3 pb-3">
        <Footer />
      </div>
    </div>
  );
}
