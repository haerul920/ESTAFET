import "../../scripts/lib/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Overlap audit (CLAUDE.md 14.9). For every key route at every test viewport it checks that
 *  (a) the centre of every visible interactive element hits that element (or its label), so nothing covers it,
 *  (b) the page has no horizontal overflow,
 *  (c) text is not clipped by an overflow:hidden box,
 *  (d) on Home, the floating hero cards never touch the headline, the lead or the calls to action.
 * Reduced motion is on for (a) to (c) so reveals are instant and the result is deterministic; (d) runs with motion on.
 */

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1536, height: 864 },
];

const PASSWORD = "Demo-Pass-2026!";
type Role = "guest" | "creator" | "adopter" | "alumni" | "admin";
const EMAIL: Record<Exclude<Role, "guest">, string> = {
  creator: "creator@estafet.demo",
  adopter: "adopter@estafet.demo",
  alumni: "alumni@estafet.demo",
  admin: "admin@estafet.demo",
};

// Ids from supabase/seed.sql (demo data).
const DRAFT_ID = "b0000000-0000-4000-8000-000000000007"; // coral-reef-photo-counter, owned by the demo creator
const PENDING_REQUEST = "e0000000-0000-4000-8000-000000000002"; // adopter team asks to continue fish-freshness-indicator (owner: alumni)
const DECLINED_REQUEST = "e0000000-0000-4000-8000-000000000001"; // declined request for mangrove-cover-classifier

interface RouteCase {
  name: string;
  path: string;
  role: Role;
}

const PUBLIC: RouteCase[] = [
  { name: "home", path: "/", role: "guest" },
  { name: "home en", path: "/en", role: "guest" },
  { name: "explore", path: "/explore", role: "guest" },
  { name: "explore en", path: "/en/explore", role: "guest" },
  { name: "teaser", path: "/projects/mangrove-cover-classifier", role: "guest" },
  { name: "teaser open mode", path: "/projects/campus-waste-sorting-assistant", role: "guest" },
  { name: "login", path: "/login", role: "guest" },
  { name: "signup", path: "/signup", role: "guest" },
  { name: "terms", path: "/terms", role: "guest" },
  { name: "privacy", path: "/privacy", role: "guest" },
  { name: "guidelines", path: "/pedoman", role: "guest" },
  { name: "attribution", path: "/atribusi", role: "guest" },
  { name: "contact", path: "/kontak", role: "guest" },
  { name: "not found", path: "/halaman-tidak-ada", role: "guest" },
];

const SIGNED_IN: RouteCase[] = [
  { name: "first run", path: "/mulai", role: "creator" },
  { name: "dashboard creator", path: "/dasbor", role: "creator" },
  { name: "dashboard adopter", path: "/dasbor", role: "adopter" },
  { name: "dashboard alumni", path: "/dasbor", role: "alumni" },
  { name: "my reports", path: "/laporan-saya", role: "adopter" },
  { name: "account privacy", path: "/akun/privasi", role: "creator" },
  { name: "wizard start", path: "/bagikan", role: "creator" },
  { name: "wizard info", path: `/bagikan/${DRAFT_ID}/info`, role: "creator" },
  { name: "wizard team", path: `/bagikan/${DRAFT_ID}/tim`, role: "creator" },
  { name: "wizard files", path: `/bagikan/${DRAFT_ID}/berkas`, role: "creator" },
  { name: "wizard review", path: `/bagikan/${DRAFT_ID}/tinjau`, role: "creator" },
  { name: "wizard preview", path: `/bagikan/${DRAFT_ID}/terbit`, role: "creator" },
  { name: "request form", path: "/projects/study-group-matcher/request", role: "adopter" },
  { name: "request review (owner)", path: `/requests/${PENDING_REQUEST}`, role: "alumni" },
  { name: "request view (team)", path: `/requests/${DECLINED_REQUEST}`, role: "adopter" },
  { name: "workspace", path: "/projects/mangrove-cover-classifier/workspace", role: "creator" },
  { name: "project settings", path: "/proyek/mangrove-cover-classifier/pengaturan", role: "creator" },
  { name: "project decisions", path: "/proyek/mangrove-cover-classifier/keputusan", role: "creator" },
  { name: "visitor preview", path: "/projects/mangrove-cover-classifier?as=visitor", role: "creator" },
];

const ADMIN_PAGES = [
  "/admin",
  "/admin/projects",
  "/admin/reports",
  "/admin/users",
  "/admin/policies",
  "/admin/announcements",
  "/admin/pipeline",
  "/admin/appeals",
  "/admin/requests",
  "/admin/trials",
  "/admin/audit",
  "/admin/settings",
];
const ADMIN: RouteCase[] = ADMIN_PAGES.map((p) => ({
  name: `admin ${p.replace("/admin", "") || "overview"}`,
  path: `${p}${p === "/admin" || p.includes("trials") || p.includes("projects") ? "?demo=1" : ""}`,
  role: "admin" as Role,
}));

// ---------------------------------------------------------------- sessions

type State = Awaited<ReturnType<Awaited<ReturnType<Browser["newContext"]>>["storageState"]>>;
const states = new Map<Role, State>();

async function contextFor(browser: Browser, role: Role) {
  if (role === "guest") return browser.newContext({ reducedMotion: "reduce", locale: "id-ID" });
  let state = states.get(role);
  if (!state) {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(EMAIL[role]);
    await page.getByLabel("Kata sandi").fill(PASSWORD);
    await page.getByRole("button", { name: "Masuk" }).last().click();
    await page.waitForURL(/\/(dasbor|admin|mulai)/);
    state = await ctx.storageState();
    states.set(role, state);
    await ctx.close();
  }
  return browser.newContext({ reducedMotion: "reduce", storageState: state });
}

// ---------------------------------------------------------------- the audit itself (runs in the page)

interface Issue {
  kind: string;
  detail: string;
}

async function triggerReveals(page: Page) {
  // Scroll through the page once so scroll-triggered reveals have played, then return to the top.
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = "auto";
    const step = Math.max(300, window.innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 120));
  });
}

async function audit(page: Page): Promise<Issue[]> {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await triggerReveals(page);
  return page.evaluate(() => {
    const issues: { kind: string; detail: string }[] = [];
    const label = (el: Element) => {
      const e = el as HTMLElement;
      const cls = typeof e.className === "string" ? e.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
      const text = (e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${cls ? "." + cls : ""} "${text}"`;
    };
    const visible = (el: Element) => {
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 2 && r.height >= 2;
    };
    const decorative = (el: Element) => !!el.closest('[aria-hidden="true"], [inert]');
    const vw = document.documentElement.clientWidth;

    // (b) horizontal overflow
    if (document.documentElement.scrollWidth > vw + 1) {
      issues.push({
        kind: "overflow-x",
        detail: `page is ${document.documentElement.scrollWidth}px wide in a ${vw}px viewport`,
      });
      // name the widest offenders to make it fixable
      const wide = [...document.querySelectorAll("body *")]
        .filter((el) => visible(el) && !decorative(el) && el.getBoundingClientRect().right > vw + 1)
        .slice(0, 4);
      for (const el of wide)
        issues.push({
          kind: "overflow-x-element",
          detail: `${label(el)} ends at ${Math.round(el.getBoundingClientRect().right)}px`,
        });
    }

    // (a) every visible interactive element can be hit at its centre
    document.documentElement.style.scrollBehavior = "auto";
    const interactive = document.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="menuitem"], [role="link"]',
    );
    for (const el of interactive) {
      if (!visible(el) || decorative(el)) continue;
      if (el.matches('.sr-only, [class*="sr-only"]')) continue;
      // "nearest" horizontally: centring would scroll overflow:hidden boxes sideways and fake a clipping problem.
      el.scrollIntoView({ block: "center", inline: "nearest" });
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx < 0 || cx > window.innerWidth) {
        issues.push({ kind: "unreachable", detail: `${label(el)} is outside the viewport horizontally` });
        continue;
      }
      const hit = document.elementFromPoint(cx, Math.min(Math.max(cy, 1), window.innerHeight - 1));
      // The Next.js development indicator is tooling, not part of the product.
      if (hit && hit.tagName === "NEXTJS-PORTAL") continue;
      const labelled = (el as HTMLInputElement).labels
        ? [...(el as HTMLInputElement).labels!].some((l) => hit && l.contains(hit))
        : false;
      const ok =
        hit && (hit === el || el.contains(hit) || hit.contains(el) || labelled || el.closest("label")?.contains(hit));
      if (!ok) issues.push({ kind: "covered", detail: `${label(el)} is covered by ${hit ? label(hit) : "nothing"}` });
    }
    window.scrollTo(0, 0);
    // Undo any scrolling that scrollIntoView caused inside overflow boxes, so the clipping check sees the real layout.
    for (const box of document.querySelectorAll("body *")) {
      if (box.scrollLeft !== 0) box.scrollLeft = 0;
      if (box.scrollTop !== 0 && /(hidden|clip)/.test(getComputedStyle(box).overflowY)) box.scrollTop = 0;
    }

    // (c) clipped text
    const clips = (cs: CSSStyleDeclaration) => /(hidden|clip)/.test(cs.overflowX) || /(hidden|clip)/.test(cs.overflowY);
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el) || decorative(el)) continue;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1);
      if (!hasText) continue;
      const cs = getComputedStyle(el);
      const clamp = (cs as unknown as { webkitLineClamp?: string }).webkitLineClamp;
      const intentional = cs.textOverflow === "ellipsis" || (clamp && clamp !== "none");
      if (clips(cs) && !intentional && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)) {
        issues.push({
          kind: "clipped-text",
          detail: `${label(el)} (content ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`,
        });
        continue;
      }
      let a = el.parentElement;
      while (a && a !== document.body && !(clips(getComputedStyle(a)) && getComputedStyle(a).display !== "contents"))
        a = a.parentElement;
      if (a && a !== document.body && a !== document.documentElement) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const t = range.getBoundingClientRect();
        const c = a.getBoundingClientRect();
        if (t.right > c.right + 2 || t.left < c.left - 2 || t.bottom > c.bottom + 2 || t.top < c.top - 2) {
          issues.push({ kind: "clipped-text", detail: `${label(el)} is cut off by ${label(a)}` });
        }
      }
    }
    return issues;
  });
}

function summarize(route: string, vp: { width: number; height: number }, issues: Issue[]): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const i of issues) {
    const n = (seen.get(i.kind) ?? 0) + 1;
    seen.set(i.kind, n);
    if (n <= 6) out.push(`${route} @ ${vp.width}x${vp.height}: ${i.kind}: ${i.detail}`);
  }
  return out;
}

// ---------------------------------------------------------------- tests

for (const group of [
  { title: "public pages", routes: PUBLIC },
  { title: "signed-in pages", routes: SIGNED_IN },
  { title: "admin pages", routes: ADMIN },
]) {
  for (const route of group.routes) {
    test(`overlap audit: ${group.title}: ${route.name}`, async ({ browser }) => {
      test.setTimeout(240_000);
      const ctx = await contextFor(browser, route.role);
      const page = await ctx.newPage();
      const problems: string[] = [];
      for (const vp of VIEWPORTS) {
        await page.setViewportSize(vp);
        await page.goto(route.path);
        problems.push(...summarize(route.name, vp, await audit(page)));
      }
      await ctx.close();
      expect(problems).toEqual([]);
    });
  }
}

test("overlap audit: Home hero floating cards never touch the headline, the lead or the calls to action", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  // Motion stays ON here: the cards are moving while we measure.
  const ctx = await browser.newContext({ locale: "id-ID" });
  const page = await ctx.newPage();
  const problems: string[] = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp);
    await page.goto("/");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(1500); // let the entrance animation finish
    for (let sample = 0; sample < 6; sample++) {
      const hits = await page.evaluate(() => {
        const hero = document.querySelector("h1")?.closest("section");
        if (!hero) return ["hero not found"];
        const guarded = [
          hero.querySelector("h1"),
          hero.querySelector("p.fade-up"),
          ...hero.querySelectorAll("a.btn"),
        ].filter(Boolean) as Element[];
        const floats = [...hero.querySelectorAll(".floating")].filter((f) => getComputedStyle(f).display !== "none");
        const out: string[] = [];
        if (floats.length === 0) out.push("no floating cards");
        for (const f of floats) {
          const fr = f.getBoundingClientRect();
          for (const g of guarded) {
            const gr = g.getBoundingClientRect();
            const overlap = fr.left < gr.right && fr.right > gr.left && fr.top < gr.bottom && fr.bottom > gr.top;
            if (overlap)
              out.push(
                `${(g as HTMLElement).tagName.toLowerCase()} "${(g.textContent ?? "").trim().slice(0, 24)}" overlaps a floating card`,
              );
          }
        }
        return out;
      });
      problems.push(...hits.map((h) => `home @ ${vp.width}x${vp.height} sample ${sample}: ${h}`));
      await page.waitForTimeout(1400);
    }
    if (vp.width <= 390) {
      const visibleCards = await page.evaluate(
        () => [...document.querySelectorAll(".floating")].filter((f) => getComputedStyle(f).display !== "none").length,
      );
      if (visibleCards !== 3)
        problems.push(`home @ ${vp.width}: phones must show 3 floating cards, found ${visibleCards}`);
    }
  }
  await ctx.close();
  expect([...new Set(problems)]).toEqual([]);
});

test("overlap audit: the phone drawer and the account menu are never covered", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await contextFor(browser, "creator");
  const page = await ctx.newPage();
  const problems: string[] = [];

  async function hitCheck(where: string, selector: string) {
    const bad = await page.evaluate((sel) => {
      const out: string[] = [];
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width < 2) continue;
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!(hit && (hit === el || el.contains(hit) || hit.contains(el))))
          out.push((el.textContent ?? "").trim().slice(0, 30) || el.tagName);
      }
      return out;
    }, selector);
    problems.push(...bad.map((b) => `${where}: "${b}" is covered`));
  }

  for (const vp of [VIEWPORTS[0], VIEWPORTS[1], VIEWPORTS[2]]) {
    await page.setViewportSize(vp);
    await page.goto("/explore");
    await page.getByRole("button", { name: "Buka menu" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(400);
    await hitCheck(`drawer @ ${vp.width}`, '[role="dialog"] a, [role="dialog"] button');
    // focus is trapped inside the drawer
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    // focus returns to the opener
    await expect(page.getByRole("button", { name: "Buka menu" })).toBeFocused();
  }

  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp);
    await page.goto("/explore");
    await page.getByRole("button", { name: /Menu akun/ }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.waitForTimeout(300);
    await hitCheck(`account menu @ ${vp.width}`, '[role="menu"] [role="menuitem"]');
    const r = await page.getByRole("menu").boundingBox();
    if (r && (r.x < 0 || r.x + r.width > vp.width + 1))
      problems.push(`account menu @ ${vp.width}: leaves the viewport`);
    await page.keyboard.press("Escape");
  }
  await ctx.close();
  expect(problems).toEqual([]);
});

test("overlap audit: prefers-reduced-motion disables looping animations (.floating and .cloud-drift)", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => undefined);

  const activeAnimations = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll(".floating, .cloud-drift")) {
      const name = getComputedStyle(el).animationName;
      if (name && name !== "none") {
        out.push(`${el.className}: animation-name=${name}`);
      }
    }
    return out;
  });
  await ctx.close();
  expect(activeAnimations).toEqual([]);
});
