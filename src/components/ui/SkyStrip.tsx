import { Cloud } from "./motion";

/** Short sky strip behind the nav on inner pages. It fades to white. Decoration only: the header is the nav row. */
export function SkyStrip({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden px-6 pb-12 pt-4 max-sm:px-3 max-sm:pb-7 max-sm:pt-3"
      style={{ background: "var(--sky-strip)" }}
    >
      <Cloud className="-left-[60px] top-[50px] h-[90px] w-[320px] opacity-55 blur-[24px]" drift={22} duration={48} />
      <Cloud className="-right-10 top-5 h-20 w-[300px] opacity-50 blur-[24px]" drift={-20} duration={62} />
      {children}
    </div>
  );
}
