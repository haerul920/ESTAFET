import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui/PageShell";

export default function Loading() {
  const t = useTranslations("wizard");
  return (
    <PageShell>
      <div className="skeleton mb-2 h-10 w-56" />
      <div className="skeleton mb-8 h-5 w-80 max-w-full" />
      <div
        className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4"
        role="status"
        aria-busy="true"
        aria-label={t("loadingDashboard")}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-[110px] rounded-[28px]" />
        ))}
      </div>
      <div className="skeleton h-[220px] rounded-[28px]" />
    </PageShell>
  );
}
