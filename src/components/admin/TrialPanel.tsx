"use client";

import { useRouter, usePathname } from "@/i18n/navigation";
import { TrialForm, type TrialDraft } from "./TrialForm";

export function TrialPanel({ initial, projects }: { initial: TrialDraft; projects: { id: string; title: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  return <TrialForm initial={initial} projects={projects} onClose={() => router.replace(pathname, { scroll: false })} />;
}
