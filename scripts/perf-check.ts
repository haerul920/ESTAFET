/**
 * Measures LCP, CLS and JavaScript weight for Home and Explore on a throttled mid-range phone profile.
 * Usage: pnpm perf   (point E2E_BASE_URL at a production build for realistic numbers: `pnpm build` then `pnpm start`)
 * Profile: Moto G Power-class: 4x CPU slowdown, 1.6 Mbps down, 150 ms RTT (Lighthouse "slow 4G" mobile defaults).
 * Prints a Markdown table to paste into docs/performance.md.
 */
import "./lib/env";
import { chromium } from "@playwright/test";

const base = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const PAGES = [
  { name: "Home (id)", path: "/" },
  { name: "Explore (id)", path: "/explore" },
];
const RUNS = Number(process.env.PERF_RUNS ?? 3);

interface Sample {
  lcp: number;
  cls: number;
  jsKb: number;
  transferKb: number;
}

async function measure(path: string): Promise<Sample> {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  let jsBytes = 0;
  let totalBytes = 0;
  cdp.on("Network.loadingFinished", () => undefined);
  page.on("response", async (r) => {
    try {
      const len = Number(r.headers()["content-length"] ?? 0) || (await r.body()).length;
      totalBytes += len;
      if ((r.headers()["content-type"] ?? "").includes("javascript")) jsBytes += len;
    } catch {
      /* redirects have no body */
    }
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number; __cls: number; __lcpEl: string };
    w.__lcp = 0;
    w.__cls = 0;
    w.__lcpEl = "";
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { startTime: number; element?: Element; size: number }[]) {
        w.__lcp = e.startTime;
        const el = e.element;
        w.__lcpEl = el
          ? `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} "${(el.textContent ?? "").trim().slice(0, 30)}" size=${e.size}`
          : "(removed)";
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(base + path, { waitUntil: "load" });
  await page.waitForTimeout(4000); // let LCP settle and the entrance animations finish
  // LCP is read BEFORE any scrolling: a real visitor's LCP is the first screen, and scrolling would add later candidates.
  const first = await page.evaluate(() => {
    const w = window as unknown as { __lcp: number; __lcpEl: string };
    return { lcp: w.__lcp, lcpEl: w.__lcpEl };
  });
  // Then scroll once: layout shifts while reveals play count against CLS.
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 600) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(800);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  const { lcp, lcpEl } = first;
  if (process.env.PERF_DEBUG) console.log(`  LCP element for ${path}: ${lcpEl} at ${Math.round(lcp)} ms`);
  await browser.close();
  return { lcp, cls, jsKb: jsBytes / 1024, transferKb: totalBytes / 1024 };
}

const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function main() {
  console.log(`Target: ${base}  runs per page: ${RUNS}\n`);
  console.log("| Page | LCP (median) | CLS (median) | JavaScript | Transferred |");
  console.log("|---|---|---|---|---|");
  for (const p of PAGES) {
    const s: Sample[] = [];
    for (let i = 0; i < RUNS; i++) s.push(await measure(p.path));
    console.log(
      `| ${p.name} | ${(median(s.map((x) => x.lcp)) / 1000).toFixed(2)} s | ${median(s.map((x) => x.cls)).toFixed(3)} | ${Math.round(median(s.map((x) => x.jsKb)))} KB | ${Math.round(median(s.map((x) => x.transferKb)))} KB |`,
    );
  }
}

void main();
