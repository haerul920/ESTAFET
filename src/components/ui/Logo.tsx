import Link from "next/link";

/** Two overlapping rounded bars: a baton passed between teams. */
export function LogoMark({ size = 30, onSky = false }: { size?: number; onSky?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      <rect x="2" y="12" width="18" height="7" rx="3.5" fill={onSky ? "#FFFFFF" : "#1760D6"} />
      <rect x="10" y="12" width="18" height="7" rx="3.5" fill="#CDF54B" />
    </svg>
  );
}

export function Logo({ onSky = false, size = 30 }: { onSky?: boolean; size?: number }) {
  return (
    <Link
      href="/"
      aria-label="ESTAFET home"
      className={`flex items-center gap-2.5 no-underline ${onSky ? "text-white" : "text-ink"}`}
    >
      <LogoMark size={size} onSky={onSky} />
      <span className="text-[19px] font-semibold tracking-[0.02em]">ESTAFET</span>
    </Link>
  );
}
