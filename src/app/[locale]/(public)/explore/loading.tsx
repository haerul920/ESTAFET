import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui/PageShell";

export default function Loading() {
  const t = useTranslations("explore");
  return (
    <PageShell>
      <div className="skeleton mb-2 h-10 w-72" />
      <div className="skeleton mb-8 h-5 w-96 max-w-full" />
      <div className="skeleton mb-8 h-12 w-full" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4" aria-busy="true" aria-label={t("loading")}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-[260px] rounded-[28px]" />
        ))}
      </div>
    </PageShell>
  );
}
