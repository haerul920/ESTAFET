import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing, type Locale } from "@/i18n/routing";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, sessionCookieOptions } from "./keys";

const PROTECTED_PREFIXES = [
  "/dasbor",
  "/dashboard",
  "/mulai",
  "/bagikan",
  "/proyek",
  "/requests",
  "/laporan-saya",
  "/akun",
  "/kebijakan",
];

function needsSession(pathname: string) {
  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (/^\/projects\/[^/]+\/(request|workspace)(\/|$)/.test(pathname)) return true;
  return false;
}

/** Splits "/en/dasbor" into the locale ("en") and the path without a prefix ("/dasbor"). Indonesian has no prefix. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const m = /^\/(en)(\/.*)?$/.exec(pathname);
  if (m) return { locale: "en", path: m[2] ?? "/" };
  return { locale: routing.defaultLocale, path: pathname };
}

const withLocale = (locale: Locale, path: string) =>
  locale === routing.defaultLocale ? path : `/${locale}${path === "/" ? "" : path}`;

/**
 * Refreshes the Supabase session cookie and redirects guests away from protected routes.
 * `base` is the response the language layer (next-intl) already prepared, so its rewrite and cookie survive.
 */
export async function updateSession(request: NextRequest, base?: NextResponse) {
  const response = base ?? NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;
  const { locale, path } = splitLocale(pathname);

  // Admin area: guests and non-admins get a plain 404 so the area is not advertised.
  if (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/")) {
    let isAdmin = false;
    if (signedIn) {
      const { data: ok } = await supabase.rpc("is_admin");
      isAdmin = ok === true;
    }
    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/__not_found`;
      url.search = "";
      return NextResponse.rewrite(url);
    }
  }

  if (!signedIn && needsSession(path)) {
    const url = request.nextUrl.clone();
    url.pathname = withLocale(locale, "/login");
    url.search = `?next=${encodeURIComponent(path + search)}`;
    return NextResponse.redirect(url);
  }
  if (signedIn && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = withLocale(locale, "/dasbor");
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
