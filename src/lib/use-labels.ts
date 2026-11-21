import { useTranslations } from "next-intl";
import { buildLabels, type Labels, type TFn } from "@/lib/labels";

/** Enum labels in the active language, for components (server or client, not async). */
export function useLabels(): Labels {
  const t = useTranslations("labels");
  return buildLabels(t as unknown as TFn);
}
