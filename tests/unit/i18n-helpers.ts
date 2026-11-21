import en from "../../messages/en.json";
import id from "../../messages/id.json";
import type { TFn } from "@/lib/labels";

const BUNDLES = { en, id } as Record<string, Record<string, unknown>>;

/** A small translator for tests: resolves a dotted key in a namespace and fills {name} placeholders. No plural support. */
export function translator(namespace: string, locale: "en" | "id" = "en"): TFn {
  return (key, values = {}) => {
    const path = `${namespace}.${key}`.split(".");
    const found = path.reduce<unknown>((o, part) => (o as Record<string, unknown> | undefined)?.[part], BUNDLES[locale]);
    if (typeof found !== "string") throw new Error(`Missing message ${namespace}.${key} (${locale})`);
    return found.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
  };
}
