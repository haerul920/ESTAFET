import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** CLAUDE.md 14.9: a z-index scale defined as tokens, nothing else. Overlays use Radix portals. */
const ROOT = path.resolve(__dirname, "../../src");
const TOKEN_FILES = new Set(
  ["styles/tokens.css", "styles/motion.css", "app/globals.css"].map((f) => path.join(ROOT, f)),
);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}

const files = walk(ROOT).filter((f) => /\.(tsx?|css)$/.test(f) && !TOKEN_FILES.has(f));

describe("layering", () => {
  it("uses only the named z-index utilities", () => {
    const bad: string[] = [];
    for (const f of files) {
      const lines = fs.readFileSync(f, "utf8").split("\n");
      lines.forEach((line, i) => {
        // Arbitrary values (z-[70]), numeric utilities (z-50, focus:z-50), inline zIndex and raw z-index declarations.
        if (/(^|[\s"'`:])-?z-(\[|\d)/.test(line) || /zIndex/.test(line) || /z-index\s*:/.test(line)) {
          bad.push(`${path.relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 100)}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it("defines every token the utilities use", () => {
    const tokens = fs.readFileSync(path.join(ROOT, "styles/tokens.css"), "utf8");
    const globals = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
    for (const name of [
      "base",
      "raised",
      "sticky",
      "nav",
      "dropdown",
      "drawer",
      "overlay",
      "modal",
      "toast",
      "system-banner",
    ]) {
      expect(tokens, `--z-${name}`).toContain(`--z-${name}:`);
      expect(globals, `z-${name}`).toContain(`@utility z-${name}`);
    }
  });

  it("keeps the scale in the order of CLAUDE.md 14.9", () => {
    const tokens = fs.readFileSync(path.join(ROOT, "styles/tokens.css"), "utf8");
    const value = (n: string) => Number(new RegExp(`--z-${n}:\\s*(\\d+)`).exec(tokens)?.[1]);
    const order = [
      "base",
      "raised",
      "sticky",
      "nav",
      "dropdown",
      "drawer",
      "overlay",
      "modal",
      "toast",
      "system-banner",
    ];
    expect(order.map(value)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });

  it("does not hand-roll overlays: dialogs, menus and popovers come from the Radix wrappers", () => {
    const bad: string[] = [];
    for (const f of files.filter((x) => x.endsWith(".tsx"))) {
      const src = fs.readFileSync(f, "utf8");
      if (/role="dialog"|role="menu"\b|aria-modal/.test(src)) bad.push(path.relative(ROOT, f));
    }
    expect(bad).toEqual([]);
  });
});
