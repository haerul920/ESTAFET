"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal, SwayGroup } from "@/components/ui/motion";
import { Link } from "@/i18n/navigation";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const ORANGE = [
  [90, 250, 7],
  [210, 268, 8],
  [330, 244, 6],
  [520, 262, 8],
  [760, 248, 7],
  [930, 270, 8],
  [1120, 252, 7],
];
const PURPLE = [
  [150, 262, 6],
  [270, 250, 7],
  [440, 270, 6],
  [640, 256, 7],
  [850, 266, 6],
  [1030, 246, 7],
  [1200, 268, 6],
];

/** The sunset-meadow moment: SVG hills animated with GSAP + ScrollTrigger parallax and swaying flowers. */
export function MeadowCta() {
  const t = useTranslations("home.meadow");
  const svgRef = useRef<SVGSVGElement>(null);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || reduce) return;
    const hills = svg.querySelectorAll<SVGPathElement>("path[data-hill]");
    if (hills.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        hills,
        { y: (i) => (i + 1) * 14 },
        {
          y: 0,
          ease: "none",
          stagger: 0.05,
          scrollTrigger: {
            trigger: svg,
            start: "top bottom",
            end: "bottom bottom",
            scrub: 0.7,
          },
        },
      );
    }, svg);
    return () => ctx.revert();
  }, [reduce]);

  return (
    <section className="p-3">
      <div
        className="relative overflow-hidden rounded-[36px] px-8 pb-[170px] pt-14 text-center max-md:pb-[145px] max-md:pt-11 max-sm:rounded-[28px] max-sm:px-5 max-sm:pb-[125px] max-sm:pt-9"
        style={{ background: "var(--meadow-sky)" }}
      >
        <Reveal className="relative z-raised mx-auto max-w-[640px]">
          <h2 className="mb-3 text-[60px] font-medium leading-[1.04] tracking-[-0.045em] text-[#1A1A2E] max-lg:text-[50px] max-md:text-[38px] max-sm:text-[30px]">
            {t("title")}
          </h2>
          <p className="mb-6 text-lg text-[#3C3A4D] max-sm:mb-5 max-sm:text-base">{t("text")}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <ButtonLink href="/bagikan" variant="white" size="md" className="px-7 py-3.5 text-base">
              {t("start")}
            </ButtonLink>
            <Link href="/explore" className="link-anim rounded-full px-3 py-3 text-base font-medium text-[#1A1A2E]">
              {t("explore")}
            </Link>
          </div>
        </Reveal>
        <svg
          ref={svgRef}
          aria-hidden="true"
          viewBox="0 0 1280 300"
          preserveAspectRatio="none"
          className="pointer-events-none absolute bottom-0 left-0 z-base h-[215px] w-full max-md:h-[180px] max-sm:h-[150px]"
        >
          <path
            data-hill="1"
            d="M0 120 C200 40 360 90 560 70 C760 50 980 20 1280 90 L1280 300 L0 300 Z"
            fill="#8FA85A"
          />
          <path
            data-hill="2"
            d="M0 170 C220 110 420 160 640 130 C860 100 1060 120 1280 160 L1280 300 L0 300 Z"
            fill="#6F8F3D"
          />
          <path
            data-hill="3"
            d="M0 220 C260 180 480 230 720 200 C960 170 1120 200 1280 210 L1280 300 L0 300 Z"
            fill="#4F7230"
          />
          {ORANGE.map(([cx, cy, r], i) => (
            <SwayGroup key={`o${i}`} duration={3.2 + (i % 3) * 0.8} delay={i * 0.4} angle={4}>
              <line x1={cx} y1={cy} x2={cx} y2={cy + 16} stroke="#3F5E27" strokeWidth="2" />
              <circle cx={cx} cy={cy} r={r} fill="#F26A21" />
            </SwayGroup>
          ))}
          {PURPLE.map(([cx, cy, r], i) => (
            <SwayGroup key={`p${i}`} duration={3.6 + (i % 3) * 0.7} delay={i * 0.3} angle={5}>
              <line x1={cx} y1={cy} x2={cx} y2={cy + 16} stroke="#3F5E27" strokeWidth="2" />
              <circle cx={cx} cy={cy} r={r} fill="#8B6FD1" />
            </SwayGroup>
          ))}
        </svg>
      </div>
    </section>
  );
}
