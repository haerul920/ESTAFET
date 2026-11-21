import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal, SwayGroup } from "@/components/ui/motion";
import { Link } from "@/i18n/navigation";

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

/** The one sunset-meadow moment: pure SVG hills with flowers that sway gently. */
export function MeadowCta() {
  const t = useTranslations("home.meadow");
  return (
    <section className="p-3">
      <div
        className="relative min-h-[640px] overflow-hidden rounded-[36px] px-8 pb-0 pt-[72px] text-center max-sm:px-5"
        style={{ background: "var(--meadow-sky)" }}
      >
        <Reveal className="relative z-raised mx-auto max-w-[640px]">
          <h2 className="mb-4 text-[72px] font-medium leading-[1.02] tracking-[-0.045em] text-[#1A1A2E] max-md:text-5xl">{t("title")}</h2>
          <p className="mb-7 text-lg text-[#3C3A4D]">{t("text")}</p>
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
          aria-hidden="true"
          viewBox="0 0 1280 300"
          preserveAspectRatio="none"
          className="pointer-events-none absolute bottom-0 left-0 z-base h-[300px] w-full"
        >
          <path d="M0 120 C200 40 360 90 560 70 C760 50 980 20 1280 90 L1280 300 L0 300 Z" fill="#8FA85A" />
          <path d="M0 170 C220 110 420 160 640 130 C860 100 1060 120 1280 160 L1280 300 L0 300 Z" fill="#6F8F3D" />
          <path d="M0 220 C260 180 480 230 720 200 C960 170 1120 200 1280 210 L1280 300 L0 300 Z" fill="#4F7230" />
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
