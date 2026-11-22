import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { staticHeaders } from "./src/lib/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // A second dev server (for example the e2e one) can use its own build folder: NEXT_DIST_DIR=.next-e2e
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Cache Components is not used: every data page reads the Supabase session cookie,
  // so pages are rendered per request (see README, "Architecture notes").
  cacheComponents: false,
  partialPrefetching: false,
  // Accept Supabase's newer "publishable key" name as an alias for the anon key (public by design).
  env: {
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  },
  // The dashboard moved to /dasbor (CLAUDE.md 14.3). Old links keep working, in both languages.
  async redirects() {
    return [
      { source: "/dashboard", destination: "/dasbor", permanent: false },
      { source: "/en/dashboard", destination: "/en/dasbor", permanent: false },
      // R4: the share wizard moved to /bagikan with new step names. Old links and bookmarks keep working.
      { source: "/share", destination: "/bagikan", permanent: true },
      { source: "/en/share", destination: "/en/bagikan", permanent: true },
      ...[
        ["basics", "info"],
        ["files", "berkas"],
        ["verify", "tinjau"],
        ["consent", "tim"],
        ["publish", "terbit"],
      ].flatMap(([from, to]) => [
        { source: `/share/:id/${from}`, destination: `/bagikan/:id/${to}`, permanent: true },
        { source: `/en/share/:id/${from}`, destination: `/en/bagikan/:id/${to}`, permanent: true },
      ]),
    ];
  },
  // Fixed security headers on every response. The Content-Security-Policy (it needs a nonce per request) is in src/proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: staticHeaders({
          production:
            process.env.NODE_ENV === "production" && (process.env.APP_ENV ?? "PRODUCTION").toUpperCase() !== "LOCAL",
        }),
      },
    ];
  },
  poweredByHeader: false,
  serverExternalPackages: ["pdfjs-dist", "@react-pdf/renderer", "jszip"],
  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
