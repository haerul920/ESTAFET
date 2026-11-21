import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SiteNav } from "./SiteHeader";
import { SkyStrip } from "./SkyStrip";
import { Footer } from "./Footer";

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
      <SkyStrip>
        <SiteNav variant="strip" />
      </SkyStrip>
      <main id="main" className="mx-auto w-full flex-1 px-8 pb-16 pt-8 max-sm:px-4" style={{ maxWidth: width }}>
        {children}
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
