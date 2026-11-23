import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";

/** Same shape as the re-acceptance card (title, text, two links, notice, checkbox, two buttons), so nothing jumps. */
export default function Loading() {
  const t = useTranslations("common");
  return (
    <PageShell width={680}>
      <Card className="sk-surface mt-4 flex flex-col gap-4">
        <div role="status" aria-busy="true" aria-live="polite">
          <span className="sr-only">{t("loadingPage")}</span>
          <div aria-hidden="true" className="flex flex-col gap-4">
            <div className="skeleton h-9 w-[85%] max-w-full" />
            <div className="flex flex-col gap-2">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-[70%]" />
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="skeleton h-5 w-56 max-w-full" />
              <div className="skeleton h-5 w-48 max-w-full" />
            </div>
            <div className="skeleton h-12 w-full rounded-[14px]" />
            <div className="flex items-start gap-3">
              <div className="skeleton h-5 w-5 flex-none rounded" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-24" />
              </div>
            </div>
            <div className="skeleton h-12 w-52 rounded-full" />
            <div className="skeleton h-12 w-32 rounded-full" />
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
