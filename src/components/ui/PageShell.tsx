import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SiteNav } from "./SiteHeader";
import { SkyStrip } from "./SkyStrip";
import { Footer } from "./Footer";
import { PageMotion } from "./PageMotion";

/** Inner page frame: sky strip with the glass nav, main content area, footer. */
export function PageShell({
  children,
  width = 1120,
  footerNote,
}: {
  children: React.ReactNode;
  width?: number;
  footerNote?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Sticks 12 px from the top. It starts 16 px down (12 px on phones), where the spacer in the sky is. */}
      <header className="sticky -top-1 z-nav h-0 max-sm:top-0">
        <div className="px-6 pt-4 max-sm:px-3 max-sm:pt-3">
          <SiteNav variant="strip" />
        </div>
      </header>
      <SkyStrip>
        <div aria-hidden="true" className="h-[66px]" />
      </SkyStrip>
      <main
        id="main"
        className="mx-auto w-full flex-1 px-8 pb-16 pt-8 max-md:px-6 max-sm:px-4 max-sm:pb-12 max-sm:pt-5"
        style={{ maxWidth: width }}
      >
        {children}
        <PageMotion />
      </main>
      <Footer note={footerNote} />
    </div>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  const t = useTranslations("nav");
  return (
    <nav aria-label={t("breadcrumb")} className="mb-4 text-sm text-text-2">
      {items.map((it, i) => (
        <span key={it.label}>
          {i > 0 ? " / " : null}
          {it.href ? (
            <Link href={it.href} className="text-text-2 underline-offset-2 hover:underline">
              {it.label}
            </Link>
          ) : (
            <span aria-current="page">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
