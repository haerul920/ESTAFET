/** Two overlapping rounded bars: a baton passed between teams. */
export function LogoMark({ size = 30, onSky = false }: { size?: number; onSky?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      <rect x="2" y="12" width="18" height="7" rx="3.5" fill={onSky ? "#FFFFFF" : "#1760D6"} />
      <rect x="10" y="12" width="18" height="7" rx="3.5" fill="#CDF54B" />
    </svg>
  );
}
