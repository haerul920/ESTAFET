import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second dev server (for example the e2e one) can use its own build folder: NEXT_DIST_DIR=.next-e2e
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Cache Components is not used: every data page reads the Supabase session cookie,
  // so pages are rendered per request (see README, "Architecture notes").
  cacheComponents: false,
  partialPrefetching: false,
  // Accept Supabase's newer "publishable key" name as an alias for the anon key (public by design).
  env: {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  },
  // The dashboard moved to /dasbor (CLAUDE.md 14.3). Old links keep working.
  async redirects() {
    return [{ source: "/dashboard", destination: "/dasbor", permanent: false }];
  },
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

export default nextConfig;
