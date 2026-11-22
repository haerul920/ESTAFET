import { isLocale, routing, type Locale } from "./routing";

/**
 * The language for an API response. The page passes `?lang=`, otherwise the NEXT_LOCALE cookie decides, otherwise Indonesian.
 * (API routes are not under the [locale] segment, so they cannot read the locale from the URL.)
 */
export function apiLocale(request: Request): Locale {
  const fromQuery = new URL(request.url).searchParams.get("lang");
  if (isLocale(fromQuery)) return fromQuery;
  const fromCookie = request.headers.get("cookie")?.match(/(?:^|;\s*)NEXT_LOCALE=(id|en)/)?.[1];
  if (isLocale(fromCookie)) return fromCookie;
  return routing.defaultLocale;
}
