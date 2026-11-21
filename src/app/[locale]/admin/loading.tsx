import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("admin.common");
  return (
    <div aria-busy="true" aria-label={t("loading")}>
      <div className="skeleton mb-2 h-8 w-48" />
      <div className="skeleton mb-6 h-4 w-72 max-w-full" />
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24 rounded-3xl" />
        ))}
      </div>
      <div className="skeleton h-64 rounded-3xl" />
    </div>
  );
}
