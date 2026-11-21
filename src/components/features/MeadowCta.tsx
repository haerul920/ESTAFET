"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/Button";
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

/** The one sunset-meadow moment: pure SVG hills with swaying flowers. */
export function MeadowCta() {
  const t = useTranslations("home.meadow");
  return (
    <section className="p-3">
      <div
        className="relative min-h-[640px] overflow-hidden rounded-[36px] px-8 pb-0 pt-[72px] text-center max-sm:px-5"
        style={{ background: "var(--meadow-sky)" }}
      >
        <motion.div
          className="relative mx-auto max-w-[640px]"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="mb-4 text-[72px] font-medium leading-[1.02] tracking-[-0.045em] text-[#1A1A2E] max-md:text-5xl">
            {t("title")}
          </h2>
          <p className="mb-7 text-lg text-[#3C3A4D]">{t("text")}</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <ButtonLink href="/share" variant="white" size="md" className="px-7 py-3.5 text-base">
              {t("start")}
            </ButtonLink>
            <Link href="/explore" className="rounded-full px-3 py-3 text-base font-medium text-[#1A1A2E] no-underline hover:underline">
              {t("explore")}
            </Link>
          </div>
        </motion.div>
        <svg
          aria-hidden="true"
          viewBox="0 0 1280 300"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 h-[300px] w-full"
        >
          <motion.path
            d="M0 120 C200 40 360 90 560 70 C760 50 980 20 1280 90 L1280 300 L0 300 Z"
            fill="#8FA85A"
            initial={{ y: 40 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path
            d="M0 170 C220 110 420 160 640 130 C860 100 1060 120 1280 160 L1280 300 L0 300 Z"
            fill="#6F8F3D"
            initial={{ y: 60 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path
            d="M0 220 C260 180 480 230 720 200 C960 170 1120 200 1280 210 L1280 300 L0 300 Z"
            fill="#4F7230"
            initial={{ y: 80 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          />
          <g fill="#F26A21">
            {ORANGE.map(([cx, cy, r], i) => (
              <motion.circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 3 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
              />
            ))}
          </g>
          <g fill="#8B6FD1">
            {PURPLE.map(([cx, cy, r], i) => (
              <motion.circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 3.5 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.25 }}
              />
            ))}
          </g>
        </svg>
      </div>
    </section>
  );
}
