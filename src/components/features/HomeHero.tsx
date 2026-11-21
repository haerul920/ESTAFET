"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { Cloud, Float } from "@/components/ui/motion";

const EASE = [0.22, 1, 0.36, 1] as const;

function Line({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <span className="block overflow-hidden pb-[0.08em]">
      <motion.span
        className={`block ${className ?? ""}`}
        initial={{ y: "105%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.85, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

const cardShadow = "shadow-[0_20px_40px_rgba(10,60,150,0.25)]";

function Tilt({ deg, children, className, style }: { deg: number; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={{ transform: `perspective(900px) rotateY(${deg}deg)`, ...style }}>
      {children}
    </div>
  );
}

export function HomeHero({ nav }: { nav: React.ReactNode }) {
  const t = useTranslations("home.hero");
  return (
    <section className="p-3">
      <div
        className="relative min-h-[900px] overflow-hidden rounded-[36px] px-6 pb-0 pt-5"
        style={{ background: "var(--sky-gradient)" }}
      >
        <Cloud className="-left-[60px] top-[360px] h-[90px] w-[320px] opacity-55 blur-[24px]" drift={30} duration={18} />
        <Cloud className="-right-10 top-[240px] h-20 w-[300px] opacity-45 blur-[24px]" drift={-26} duration={20} />
        <Cloud className="-left-[120px] bottom-5 h-[210px] w-[560px] opacity-95 blur-[30px]" drift={20} duration={22} />
        <Cloud className="-right-[100px] bottom-0 h-[230px] w-[620px] opacity-95 blur-[30px]" drift={-24} duration={24} />
        <Cloud className="bottom-[-70px] left-[30%] h-[170px] w-[640px] opacity-95 blur-[28px]" drift={16} duration={26} />

        {nav}

        <div className="relative mx-auto mt-[88px] max-w-[860px] text-center max-sm:mt-14">
          <h1 className="mb-6 text-[72px] font-medium leading-[1.02] tracking-[-0.045em] text-white max-md:text-[48px] max-sm:text-[40px]">
            <Line delay={0.1}>{t("line1")}</Line>
            <Line delay={0.22} className="text-[#C7E2FF]">
              {t("line2")}
            </Line>
          </h1>
          <motion.p
            className="mx-auto mb-9 max-w-[560px] text-lg text-white/95"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
          >
            {t("lead")}
          </motion.p>
          <motion.div
            className="flex flex-wrap justify-center gap-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65, ease: EASE }}
          >
            <ButtonLink href="/explore" variant="dark" size="lg">
              {t("explore")}
            </ButtonLink>
            <ButtonLink href="/share" size="lg" arrow>
              {t("share")}
            </ButtonLink>
          </motion.div>
        </div>

        <motion.div
          aria-hidden="true"
          className="relative -mx-10 mt-[72px] flex items-center justify-center gap-4 overflow-hidden py-6 max-md:justify-start max-md:pl-10"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8, ease: EASE }}
        >
          <Float delay={0.2} className="flex-none">
            <Tilt deg={55} className={`h-[170px] w-[120px] rounded-[20px] bg-white p-3.5 ${cardShadow}`}>
              <div className="mb-2.5 text-xs font-semibold">{t("cardObjectives")}</div>
              <div className="mb-2 h-2 w-4/5 rounded-full bg-blue" />
              <div className="mb-2 h-2 w-3/5 rounded-full bg-blue" />
              <div className="h-2 w-2/5 rounded-full bg-[#E1E5E9]" />
            </Tilt>
          </Float>
          <Float delay={0.9} className="flex-none">
            <Tilt deg={38} className={`h-[190px] w-[140px] rounded-[20px] bg-white p-3.5 ${cardShadow}`}>
              <div className="mb-2.5 text-xs font-semibold">{t("cardTasks")}</div>
              <div className="mb-2 text-xs">{t("task1")}</div>
              <div className="mb-2 text-xs">{t("task2")}</div>
              <div className="mb-2 text-xs">{t("task3")}</div>
            </Tilt>
          </Float>
          <Float delay={0.5} className="flex-none">
            <Tilt deg={18} className={`flex h-[190px] w-[150px] flex-col justify-between rounded-[20px] bg-lime p-4 ${cardShadow}`}>
              <div className="text-xs font-semibold">{t("cardNext")}</div>
              <div>
                <div className="text-[52px] font-medium leading-none tracking-[-0.04em]">4</div>
                <div className="text-xs">{t("cardNextCount")}</div>
              </div>
            </Tilt>
          </Float>
          <Float delay={1.3} amount={6} className="flex-none">
            <div className="h-[220px] w-[210px] rounded-[22px] bg-white p-4 shadow-[0_24px_50px_rgba(10,60,150,0.3)]">
              <div className="mb-1 text-[13px] font-semibold">{t("cardStands")}</div>
              <div className="mb-2.5 text-xs text-text-2">{t("cardStandsSub")}</div>
              <svg viewBox="0 0 180 90" width="100%" height="90" role="presentation">
                <motion.path
                  d="M0 80 L30 70 L60 62 L90 50 L120 34 L150 22 L180 10"
                  fill="none"
                  stroke="#1760D6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.6, delay: 1.4, ease: EASE }}
                />
                <path d="M0 80 L30 70 L60 62 L90 50 L120 34 L150 22 L180 10 L180 90 L0 90 Z" fill="#1760D6" opacity="0.12" />
              </svg>
            </div>
          </Float>
          <Float delay={0.1} amount={6} className="flex-none">
            <div className="flex h-[220px] w-[200px] flex-col justify-between rounded-[22px] bg-black p-[18px] text-white shadow-[0_24px_50px_rgba(10,60,150,0.3)]">
              <div className="text-[13px]">
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-lime" />
                {t("evidence")}
              </div>
              <div className="text-[20px] font-medium leading-[1.2] tracking-[-0.02em]">
                {t("aiDrafts")}
                <br />
                {t("peopleDecide")}
              </div>
            </div>
          </Float>
          <Float delay={0.7} className="flex-none">
            <Tilt
              deg={-18}
              className="glass flex h-[190px] w-[170px] flex-col justify-between rounded-[22px] p-4 text-white shadow-[0_20px_40px_rgba(10,60,150,0.25)]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-blue">
                <Plus size={20} />
              </div>
              <div className="text-base font-medium">
                {t("requestA")}
                <br />
                {t("requestB")}
              </div>
            </Tilt>
          </Float>
          <Float delay={1.1} className="flex-none">
            <Tilt deg={-38} className={`h-[190px] w-[140px] rounded-[20px] bg-white p-3.5 ${cardShadow}`}>
              <div className="mb-3 text-xs font-semibold">{t("cardLineage")}</div>
              <div className="mb-2.5 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue" />
                <span className="text-xs">{t("lineageOrigin")}</span>
              </div>
              <div className="mb-2.5 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue" />
                <span className="text-xs">{t("lineagePublished")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full border border-black bg-lime" />
                <span className="text-xs">{t("lineageNext")}</span>
              </div>
            </Tilt>
          </Float>
          <Float delay={0.4} className="flex-none">
            <Tilt deg={-55} className={`h-[170px] w-[120px] rounded-[20px] bg-white p-3.5 ${cardShadow}`}>
              <div className="mb-2 text-xs font-semibold">{t("cardProgress")}</div>
              <div className="text-[34px] font-medium tracking-[-0.04em]">60%</div>
            </Tilt>
          </Float>
        </motion.div>

        <p className="mono-label relative mt-2 pb-[110px] text-center text-xs text-[#0E3A7A]">
          {t("stack")}
        </p>
      </div>
    </section>
  );
}
