import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { Cloud, Floating, ParallaxLayer, WordReveal } from "@/components/ui/motion";

const cardShadow = "shadow-[0_20px_40px_rgba(10,60,150,0.25)]";

function Tilt({ deg, children, className }: { deg: number; children: React.ReactNode; className?: string }) {
  return (
    <div className={className} style={{ transform: `perspective(900px) rotateY(${deg}deg)` }}>
      {children}
    </div>
  );
}

/*
 * Layout contract (CLAUDE.md 14.9): the hero is a vertical stack of three rows: the navigation, the copy
 * (headline, lead, calls to action) and the card stage. The floating cards live only in the stage row, which
 * has its own padding for the float amplitude (max 16 px) and rotation, so a card can never touch the headline,
 * the lead or a button at any width. Clouds and cards are aria-hidden, pointer-events none and sit below content.
 */
export function HomeHero({ nav }: { nav: React.ReactNode }) {
  const t = useTranslations("home.hero");
  return (
    <section className="p-3">
      <div
        className="relative isolate overflow-hidden rounded-[36px] px-6 pt-5"
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

        <div className="relative z-raised">{nav}</div>

        <div className="relative z-raised mx-auto mt-[88px] max-w-[860px] text-center max-sm:mt-14">
          <h1 className="mb-6 text-[72px] font-medium leading-[1.02] tracking-[-0.045em] text-white max-md:text-[48px] max-sm:text-[40px]">
            <WordReveal text={t("line1")} className="block" baseDelay={100} />
            <WordReveal text={t("line2")} className="block text-[#EAF4FF]" baseDelay={420} />
          </h1>
          <p
            className="fade-up mx-auto mb-9 max-w-[560px] text-lg text-white/95"
            style={{ "--delay": "500ms" } as React.CSSProperties}
          >
            {t("lead")}
          </p>
          <div
            className="fade-up flex flex-wrap justify-center gap-3"
            style={{ "--delay": "650ms" } as React.CSSProperties}
          >
            <ButtonLink href="/explore" variant="dark" size="lg" glow>
              {t("explore")}
            </ButtonLink>
            <ButtonLink href="/bagikan" size="lg" arrow glow>
              {t("share")}
            </ButtonLink>
          </div>
        </div>

        {/* Card stage: its own row, with room for the float amplitude and rotation. */}
        <div
          aria-hidden="true"
          className="fade-up pointer-events-none relative z-base -mx-10 mt-14 flex items-center justify-center gap-4 overflow-x-clip px-10 py-10 max-md:justify-start max-sm:mx-0 max-sm:mt-10 max-sm:flex-wrap max-sm:justify-center max-sm:px-0"
          style={{ "--delay": "800ms" } as React.CSSProperties}
        >
          <Floating duration={7.2} amplitude={12} rotate={1.2} delay={0.2} className="flex-none max-sm:hidden">
            <Tilt deg={55} className={`h-[170px] w-[120px] rounded-[20px] bg-white p-3.5 ${cardShadow}`}>
              <div className="mb-2.5 text-xs font-semibold">{t("cardObjectives")}</div>
              <div className="mb-2 h-2 w-4/5 rounded-full bg-blue" />
              <div className="mb-2 h-2 w-3/5 rounded-full bg-blue" />
              <div className="h-2 w-2/5 rounded-full bg-[#E1E5E9]" />
            </Tilt>
          </Floating>
          <Floating duration={8.4} amplitude={14} rotate={1.8} delay={0.9} className="flex-none">
            <Tilt deg={38} className={`h-[190px] w-[140px] rounded-[20px] bg-white p-3.5 ${cardShadow}`}>
              <div className="mb-2.5 text-xs font-semibold">{t("cardTasks")}</div>
              <div className="mb-2 text-xs">{t("task1")}</div>
              <div className="mb-2 text-xs">{t("task2")}</div>
              <div className="mb-2 text-xs">{t("task3")}</div>
            </Tilt>
          </Floating>
          <Floating duration={6.4} amplitude={10} rotate={2.2} delay={0.5} className="flex-none">
            <Tilt
              deg={18}
              className={`flex h-[190px] w-[150px] flex-col justify-between rounded-[20px] bg-lime p-4 ${cardShadow}`}
            >
              <div className="text-xs font-semibold">{t("cardNext")}</div>
              <div>
                <div className="text-[52px] font-medium leading-none tracking-[-0.04em]">4</div>
                <div className="text-xs">{t("cardNextCount")}</div>
              </div>
            </Tilt>
          </Floating>
          <Floating duration={8.8} amplitude={8} rotate={0.8} delay={1.3} className="flex-none max-sm:hidden">
            <div className="h-[220px] w-[210px] rounded-[22px] bg-white p-4 shadow-[0_24px_50px_rgba(10,60,150,0.3)]">
              <div className="mb-1 text-[13px] font-semibold">{t("cardStands")}</div>
              <div className="mb-2.5 text-xs text-text-2">{t("cardStandsSub")}</div>
              <svg viewBox="0 0 180 90" width="100%" height="90" role="presentation">
                <path
                  d="M0 80 L30 70 L60 62 L90 50 L120 34 L150 22 L180 10"
                  pathLength="1"
                  className="draw-path"
                  fill="none"
                  stroke="#1760D6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M0 80 L30 70 L60 62 L90 50 L120 34 L150 22 L180 10 L180 90 L0 90 Z"
                  fill="#1760D6"
                  opacity="0.12"
                />
              </svg>
            </div>
          </Floating>
          <Floating duration={7.6} amplitude={9} rotate={1.4} delay={0.1} className="flex-none max-sm:hidden">
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
          </Floating>
          <Floating duration={6.8} amplitude={16} rotate={2} delay={0.7} className="flex-none">
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
          </Floating>
          <Floating duration={9} amplitude={11} rotate={1} delay={1.1} className="flex-none max-sm:hidden">
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
          </Floating>
          <Floating duration={7} amplitude={13} rotate={1.6} delay={0.4} className="flex-none max-sm:hidden">
            <Tilt deg={-55} className={`h-[170px] w-[120px] rounded-[20px] bg-white p-3.5 ${cardShadow}`}>
              <div className="mb-2 text-xs font-semibold">{t("cardProgress")}</div>
              <div className="text-[34px] font-medium tracking-[-0.04em]">60%</div>
            </Tilt>
          </Floating>
        </div>

        <p className="mono-label relative z-raised mt-2 pb-[110px] text-center text-xs text-[#0E3A7A]">{t("stack")}</p>
      </div>
    </section>
  );
}
