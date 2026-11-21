import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { splitLocale, updateSession } from "@/lib/supabase/middleware";
import { NextResponse } from "next/server";

const intl = createIntlMiddleware(routing);

/** First the language layer (rewrites and redirects by locale), then the session and the access checks. */
export async function proxy(request: NextRequest) {
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
  matcher: ["/((?!api/(?!admin/)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
