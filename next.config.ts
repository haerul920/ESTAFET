import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is not used: every data page reads the Supabase session cookie,
  // so pages are rendered per request (see README, "Architecture notes").
  cacheComponents: false,
  partialPrefetching: false,
  // Accept Supabase's newer "publishable key" name as an alias for the anon key (public by design).
  env: {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
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
