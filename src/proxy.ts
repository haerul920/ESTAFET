import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { contentSecurityPolicy, newNonce } from "@/lib/security-headers";
import { splitLocale, updateSession } from "@/lib/supabase/middleware";

const intl = createIntlMiddleware(routing);

/**
 * Every response gets a Content-Security-Policy with a fresh nonce (and `X-Robots-Tag: noindex` outside production).
 * Next.js reads the nonce from the request's own CSP header and puts it on its scripts, so the header is set on the
 * request that goes downstream as well as on the response.
 */
export async function proxy(request: NextRequest) {
  const nonce = newNonce();
  const csp = contentSecurityPolicy({
    nonce,
    dev: process.env.NODE_ENV !== "production",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  request.headers.set("content-security-policy", csp);
  request.headers.set("x-nonce", nonce);

  const response = await route(request);
  response.headers.set("content-security-policy", csp);
  // APP_ENV is read at run time so one build can serve staging and production.
  if ((process.env.APP_ENV ?? "").toUpperCase().match(/^(STAGING|DEMO)$/)) {
    response.headers.set("x-robots-tag", "noindex, nofollow");
  }
  return response;
}

/** First the language layer (rewrites and redirects by locale), then the session and the access checks. */
async function route(request: NextRequest) {
  // The admin API keeps its guard (a plain 404 for non-admins) but is never localized.
  if (request.nextUrl.pathname.startsWith("/api/")) return updateSession(request);
  // A visitor who chose English earlier (cookie) and opens an unprefixed page lands on the English page.
  const { locale } = splitLocale(request.nextUrl.pathname);
  if (locale === "id" && request.method === "GET" && request.cookies.get("NEXT_LOCALE")?.value === "en") {
    const url = request.nextUrl.clone();
    url.pathname = `/en${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.redirect(url);
  }
  const response = intl(request);
  // A locale redirect (for example a visitor with an English cookie opening "/") is final.
  if (response.headers.has("location")) return response;
  return updateSession(request, response);
}

export const config = {
  // Pages, plus the admin API (guard only). Other API routes, Next internals and static files are untouched.
  matcher: [
    "/((?!api/(?!admin/)|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
