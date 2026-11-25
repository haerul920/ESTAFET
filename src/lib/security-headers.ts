/**
 * Security headers (CLAUDE.md 14.10).
 *
 * - `staticHeaders()` never change per request. They go on every response through `next.config.ts`.
 * - `contentSecurityPolicy()` carries a fresh nonce per request and is set by `src/proxy.ts`.
 *
 * Known trade-off: styles allow `'unsafe-inline'`, because Radix and Framer Motion write `style` attributes at run
 * time, and CSP nonces cannot cover attributes. Scripts are strict: a nonce plus `strict-dynamic`, no inline handlers.
 */

export interface CspOptions {
  nonce: string;
  /** Development needs eval (React's debugging) and a websocket (hot reload). Never true in production. */
  dev?: boolean;
  /** The Supabase project URL, for the browser's database, auth and storage calls. */
  supabaseUrl?: string;
}

function origin(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({ nonce, dev = false, supabaseUrl }: CspOptions): string {
  const supabase = origin(supabaseUrl);
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : null;
  const turnstile = "https://challenges.cloudflare.com";

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(supabase ? [supabase] : [])],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      ...(supabase ? [supabase] : []),
      ...(supabaseWs ? [supabaseWs] : []),
      turnstile,
      ...(dev ? ["ws://localhost:*", "ws://127.0.0.1:*"] : []),
    ],
    // Storage: the PDF preview shows the private file from its short-lived address.
    "frame-src": [turnstile, ...(supabase ? [supabase] : [])],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!dev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** A random nonce for one request. Edge-safe (Web Crypto only). */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function staticHeaders(opts: { production: boolean }): { key: string; value: string }[] {
  const h = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];
  // HSTS only where HTTPS is certain. Without `preload`: joining the preload list is a one-way decision for the owner.
  if (opts.production) h.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
  return h;
}
