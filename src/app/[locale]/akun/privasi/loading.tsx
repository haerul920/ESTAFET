import { PageShell } from "@/components/ui/PageShell";
import {
  Sk,
  SkButton,
  SkCheck,
  SkField,
  SkLines,
  SkPageHeader,
  SkSectionCard,
  SkStatus,
} from "@/components/ui/Skeleton";

/** Account and privacy: title, lead, then three section cards (export, email preferences, deletion). */
export default function Loading() {
  return (
    <PageShell width={820}>
      <SkStatus>
        <SkPageHeader titleWidth="w-72" lead={[100, 55]} className="mb-6" />
        <div className="flex flex-col gap-6">
          <SkSectionCard heading="w-40" lines={[100, 70]}>
            <SkButton width="w-52" />
          </SkSectionCard>
          <SkSectionCard heading="w-36" lines={[90]}>
            <SkCheck widths={[60]} />
            <SkField label="w-24" className="max-w-[260px]" />
            <SkButton width="w-28" />
          </SkSectionCard>
          <SkSectionCard heading="w-32" lines={[100, 80]}>
            <SkLines widths={[70, 64, 58]} className="pl-5" />
            <Sk className="h-11 w-44 rounded-full" />
          </SkSectionCard>
        </div>
      </SkStatus>
    </PageShell>
  );
}
