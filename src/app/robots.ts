import type { MetadataRoute } from "next";
import { shouldNoIndex } from "@/lib/admin/env";
import { siteUrl } from "@/lib/seo";

/** Read at run time (not at build), so one build can serve staging and production. */
export const dynamic = "force-dynamic";

/** Staging and demo are closed to search engines. Production allows the public pages and keeps private areas out. */
export default function robots(): MetadataRoute.Robots {
  if (shouldNoIndex()) return { rules: { userAgent: "*", disallow: "/" } };
  const priv = [
    "/admin",
    "/en/admin",
    "/api/",
    "/dasbor",
    "/en/dasbor",
    "/bagikan",
    "/en/bagikan",
    "/akun",
    "/en/akun",
    "/laporan-saya",
    "/en/laporan-saya",
    "/mulai",
    "/en/mulai",
    "/kebijakan",
    "/en/kebijakan",
    "/proyek",
    "/en/proyek",
    "/requests",
    "/en/requests",
  ];
  return {
    rules: { userAgent: "*", allow: "/", disallow: priv },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
