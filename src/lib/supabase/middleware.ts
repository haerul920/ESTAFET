import { createServerClient } from "@supabase/ssr";
import { isAuthApiError } from "@supabase/supabase-js";
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
  const { pathname, search } = request.nextUrl;
  const { locale, path } = splitLocale(pathname);

  let signedIn = false;
  let supabase: ReturnType<typeof createServerClient> | null = null;

  if (SUPABASE_URL && SUPABASE_PUBLIC_KEY) {
    try {
      supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
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
      signedIn = Boolean(data?.claims);
    } catch {
      signedIn = false;
    }
  }

  // Admin area: guests and non-admins get a plain 404 so the area is not advertised.
  if (path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/")) {
    let isAdmin = false;
    if (signedIn && supabase) {
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
  if (signedIn && supabase && (path === "/login" || path === "/signup")) {
    // getClaims() only checks the token's signature. A session that Supabase already ended (signed out, removed by an
    // admin) still passes it, while the pages ask Supabase (getUser) and send the person here: /dasbor -> /login ->
    // /dasbor -> ... forever. So before leaving the login page, ask Supabase; if the session is gone, clear the stale
    // cookies on this response and show the login form.
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!user) {
      // Clear the cookies only when Supabase itself rejected the session, never because of a network hiccup.
      if (isAuthApiError(error)) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = withLocale(locale, "/dasbor");
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (signedIn && supabase && needsPolicyCheck(request, path)) {
    // Newer Terms or Privacy Policy: send the person to the re-acceptance screen HERE, before any HTML is sent.
    // `requireUser()` in the page checks the same thing, but by then the page is already streaming, and a redirect
    // from there blanks the screen while the client fetches the next page. The page check stays as a second layer.
    const { data: accepted, error } = await supabase.rpc("i_accepted_current_policies");
    if (!error && accepted === false) {
      const url = request.nextUrl.clone();
      url.pathname = withLocale(locale, "/kebijakan/setujui");
      url.search = `?next=${encodeURIComponent(path + search)}`;
      const redirect = NextResponse.redirect(url);
      // Keep a refreshed session cookie, if getClaims() just refreshed it.
      for (const c of response.cookies.getAll()) redirect.cookies.set(c);
      return redirect;
    }
  }
  return response;
}

/**
 * Only page loads and page navigations of protected pages. Not the re-acceptance screen itself, not prefetches (the
 * real navigation checks), and not form posts (server actions run their own checks).
 */
function needsPolicyCheck(request: NextRequest, path: string): boolean {
  if (request.method !== "GET" || !needsSession(path)) return false;
  if (path === "/kebijakan" || path.startsWith("/kebijakan/")) return false;
  if (request.headers.has("next-router-prefetch")) return false;
  return true;
}
