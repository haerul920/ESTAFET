import { useTranslations } from "next-intl";
import { PageShell } from "./PageShell";

export type SkeletonVariant = "list" | "detail" | "form" | "document";

/**
 * The loading state shown by a route's `loading.tsx` while the page renders on the server.
 * Next wraps the page in <Suspense> with this as the fallback and prefetches it, so a click navigates at once and
 * the real content streams in. The nav and footer are the real ones (PageShell), only the main area is a skeleton.
 */
export function PageSkeleton({ variant = "list", width }: { variant?: SkeletonVariant; width?: number }) {
  const t = useTranslations("common");
  return (
    <PageShell width={width ?? (variant === "list" ? undefined : 820)}>
      <div role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t("loadingPage")}</span>
        <div aria-hidden="true">
          <div className="skeleton mb-3 h-10 w-72 max-w-full" />
          <div className="skeleton mb-8 h-5 w-[28rem] max-w-full" />
          {variant === "list" ? <ListShapes /> : null}
          {variant === "detail" ? <DetailShapes /> : null}
          {variant === "form" ? <FormShapes /> : null}
          {variant === "document" ? <DocumentShapes /> : null}
        </div>
      </div>
    </PageShell>
  );
}

function ListShapes() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-[180px] rounded-[28px]" />
      ))}
    </div>
  );
}

function DetailShapes() {
  return (
    <div className="flex flex-col gap-4">
      <div className="skeleton h-[140px] rounded-[28px]" />
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <div className="skeleton h-[200px] rounded-[28px]" />
        <div className="skeleton h-[200px] rounded-[28px]" />
      </div>
    </div>
  );
}

function FormShapes() {
  return (
    <div className="flex flex-col gap-5 rounded-[28px] bg-surface p-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-12 w-full rounded-[14px]" />
        </div>
      ))}
      <div className="skeleton h-12 w-44 rounded-full" />
    </div>
  );
}

function DocumentShapes() {
  return (
    <div className="flex flex-col gap-3">
      {[100, 96, 92, 98, 70, 94, 88].map((w, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}
