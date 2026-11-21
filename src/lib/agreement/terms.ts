import type { TFn } from "@/lib/labels";

/** Attribution Agreement. Keep AGREEMENT_VERSION in sync with current_agreement_version() in SQL. The wording lives in messages (`agreement.*`). */
export const AGREEMENT_VERSION = 1;

export const AGREEMENT_TERM_KEYS = ["t1", "t2", "t3", "t4"] as const;

export interface CreditLineInput {
  title: string;
  creators: string[];
  advisor: string;
  lineageId: string;
}

/** The sentence people copy into their own work. `t` is the translator for the `agreement` namespace. */
export function creditLine({ title, creators, advisor, lineageId }: CreditLineInput, t: TFn): string {
  const who = creators.length ? creators.join(", ") : t("creditWhoDefault");
  return t("credit", { title, who, advisor: advisor ? t("creditAdvisor", { name: advisor }) : "", id: lineageId });
}
