import "server-only";
import { getTranslations } from "next-intl/server";
import { buildLabels, type Labels, type TFn } from "@/lib/labels";

/** Enum labels in the active language, for async server code. */
export async function getLabels(): Promise<Labels> {
  const t = await getTranslations("labels");
  return buildLabels(t as unknown as TFn);
}
