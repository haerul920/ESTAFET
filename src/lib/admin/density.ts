/**
 * Table density in the admin area (PROMPTS_RELEASE.md R6 item 14). A per-viewer convenience kept in the browser's
 * localStorage, never in a cookie: the Privacy Policy promises only the session and language cookies.
 */
export type Density = "comfortable" | "compact";

export const DENSITY_KEY = "estafet.admin.density";

/** Anything other than "compact" (missing, blocked storage, an old value) means the default. */
export function parseDensity(value: string | null | undefined): Density {
  return value === "compact" ? "compact" : "comfortable";
}

export function readDensity(): Density {
  try {
    return parseDensity(window.localStorage.getItem(DENSITY_KEY));
  } catch {
    return "comfortable";
  }
}

const CHANGED = "estafet:admin-density";

/** For `useSyncExternalStore`: other tabs fire `storage`, this tab fires CHANGED from `saveDensity`. */
export function subscribeDensity(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

export function saveDensity(value: Density): void {
  try {
    if (value === "compact") window.localStorage.setItem(DENSITY_KEY, value);
    else window.localStorage.removeItem(DENSITY_KEY);
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    /* storage blocked (private window): the caller keeps the choice in memory until the page is reloaded */
  }
}
