import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

/**
 * Search and sharing helpers (CLAUDE.md 14.10): canonical addresses, language alternates and structured data.
 * Indonesian has no prefix in the address, English lives under /en (CLAUDE.md 14.7).
 */

export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** The full public address of a path in a language. `path` starts with "/" or is "/" for the home page. */
export function localizedUrl(locale: string, path: string, base = siteUrl()): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${base}${prefix}${path === "/" ? (prefix ? "" : "/") : path}`;
}

/** `alternates` for a page's metadata: its own canonical address, plus the page in the other language. */
export function pageAlternates(locale: string, path: string): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = localizedUrl(l, path);
  languages["x-default"] = localizedUrl(routing.defaultLocale, path);
  return { canonical: localizedUrl(locale, path), languages };
}

/** Text for a JSON-LD block that is safe inside a script tag. */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

interface ProjectForSchema {
  slug: string;
  title: string;
  summary: string;
  published_at: string | null;
  year: number;
  tech: string[] | null;
}

/**
 * Structured data for a PUBLIC project (schema.org CreativeWork). Only call it for a project the public page shows,
 * never for a held or hidden one. It carries no people: names of owners are not part of the public teaser.
 */
export function projectJsonLd(p: ProjectForSchema, locale: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: p.title,
    description: p.summary,
    url: localizedUrl(locale, `/projects/${encodeURIComponent(p.slug)}`),
    inLanguage: locale,
    ...(p.published_at ? { datePublished: p.published_at } : {}),
    ...(p.tech?.length ? { keywords: p.tech.join(", ") } : {}),
    isPartOf: { "@type": "WebSite", name: "ESTAFET", url: siteUrl() },
  };
}
