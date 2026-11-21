import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

const nav = createNavigation(routing);

/** Locale-aware Link, usePathname and useRouter. Always import these instead of next/link and next/navigation for page links. */
export const { Link, usePathname, useRouter } = nav;

/**
 * Locale-aware redirect for server code. Pass the locale from `await getLocale()`.
 * Typed as `never` (it throws Next's redirect signal) so code after a guard is narrowed correctly.
 */
export function redirect(args: Parameters<typeof nav.redirect>[0]): never {
  nav.redirect(args);
  throw new Error("redirect did not throw");
}
