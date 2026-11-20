import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";

/** Supabase client bound to the signed-in user's session cookie. RLS applies. */
export async function createClient() {
  const cookieStore = await cookies();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  // Only a salted hash of the client address is ever sent on, and only the audit log stores it.
  const ipHash = createHash("sha256").update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "").slice(-16)).digest("hex").slice(0, 32);
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { "x-estafet-ip-hash": ipHash } },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component: the proxy refreshes the session instead.
          }
        },
      },
    },
  );
}
