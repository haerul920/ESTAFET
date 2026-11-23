import { PageShell } from "@/components/ui/PageShell";
import { Sk, SkButton, SkCheck, SkField, SkPageHeader, SkStatus } from "@/components/ui/Skeleton";

/** Sign-up: title, lead, name, faculty, email, password, policy checkbox, button, sign-in line. */
export default function Loading() {
  return (
    <PageShell width={520}>
      <SkStatus>
        <SkPageHeader titleWidth="w-44" lead={[100, 80]} className="mb-6" />
        <div className="flex flex-col gap-4">
          <SkField label="w-28" />
          <SkField label="w-20" hint="w-72" />
          <SkField label="w-16" />
          <SkField label="w-24" hint="w-32" />
          <SkCheck widths={[95, 60]} />
          <SkButton width="w-full" className="mt-2" />
          <Sk className="mx-auto h-4 w-52" />
        </div>
      </SkStatus>
    </PageShell>
  );
}
