import { Cloud } from "./motion";

/** Short sky strip behind the nav on inner pages. It fades to white. */
export function SkyStrip({ children }: { children: React.ReactNode }) {
  return (
    <header className="relative overflow-hidden px-6 pb-16 pt-4" style={{ background: "var(--sky-strip)" }}>
      <Cloud className="-left-[60px] top-[50px] h-[90px] w-[320px] opacity-55 blur-[24px]" drift={22} duration={16} />
      <Cloud className="-right-10 top-5 h-20 w-[300px] opacity-50 blur-[24px]" drift={-20} duration={18} />
      {children}
    </header>
  );
}
