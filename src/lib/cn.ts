import { extendTailwindMerge } from "tailwind-merge";

// Our z-index utilities (z-nav, z-modal, ...) come from the token scale in globals.css, not from Tailwind's defaults.
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      z: [
        { z: ["base", "raised", "sticky", "nav", "dropdown", "drawer", "overlay", "modal", "toast", "system-banner"] },
      ],
    },
  },
});

/** Joins class names and lets the last conflicting Tailwind utility win (so `hidden sm:inline-flex` works on a base `inline-flex`). */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return merge(parts.filter(Boolean).join(" "));
}
