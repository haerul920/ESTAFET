import { PageShell } from "@/components/ui/PageShell";
import { Sk, SkButton, SkField, SkPageHeader, SkStatus } from "@/components/ui/Skeleton";

/** Login: title, lead, email, password, button, sign-up line. */
export default function Loading() {
  return (
    <PageShell width={520}>
      <SkStatus>
        <SkPageHeader titleWidth="w-32" lead={[100, 70]} className="mb-6" />
        <div className="flex flex-col gap-4">
          <SkField label="w-16" />
          <SkField label="w-24" />
          <SkButton width="w-full" className="mt-2" />
          <Sk className="mx-auto h-4 w-56" />
        </div>
      </SkStatus>
    </PageShell>
  );
}
