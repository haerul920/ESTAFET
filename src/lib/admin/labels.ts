/** A translator for the `admin.status` namespace: `t(key)` and `t.has(key)`. */
export interface StatusTranslator {
  (key: string): string;
  has(key: string): boolean;
}

/** The label of a status value (for example `in_review`). Unknown values fall back to the raw value with spaces. */
export function statusText(t: StatusTranslator, value: string): string {
  return t.has(value) ? t(value) : value.replaceAll("_", " ");
}
