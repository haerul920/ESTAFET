# Performance (phase R3)

Targets (CLAUDE.md 14.8 and 14.10): CLS under 0.05, LCP under 2.5 s on a mid-range phone for Home and Explore, animations only on `transform` and `opacity`, loops paused off screen.

## Measured numbers

Measured with `scripts/perf-check.ts` against a **production build** (`node scripts/prod-local.mjs`, port 3200, local Supabase, demo data), in headless Chromium with a mid-range phone profile: 390x844 at 2x, CPU 4x slower, 1.6 Mbps down, 150 ms round trip. Median of 3 runs, Indonesian pages, no cache.

| Page | LCP | CLS | JavaScript (uncompressed) | Transferred (uncompressed) |
|---|---|---|---|---|
| Home | 1.34 s | 0.000 | 853 KB | 1134 KB |
| Explore | 1.08 s | 0.000 | 853 KB | 1226 KB |

Both are under the targets. LCP is read **before** scrolling (a first version of the script scrolled first, which made a heading far down the page count as LCP and gave a false 8.8 s; that was a measuring mistake, not a page problem).

## What these numbers do not prove

- The server and the browser ran on the same computer. Real latency to a hosted site (Vercel, Supabase Singapore) adds time. Re-measure on staging in R7.
- It is an emulated throttle in Chromium, not a real phone and not Lighthouse. No real-device test has been done.
- Sizes are uncompressed; hosting compresses JavaScript and HTML, so real transfer is smaller. Not measured.
- On Home the largest painted element reported by the browser is the "Demo environment" banner (text that is painted at once), not the headline, because the headline words fade in. The headline is fully visible about 1.5 s after load (word animation: up to 420 ms delay, 7 words at 70 ms, 600 ms each). In production there is no demo banner, so re-check Home LCP there.
- The JavaScript budget is 853 KB uncompressed for both pages (shared Next.js, React, next-intl, framer-motion, Radix). The aim for R7 is to keep it from growing; framer-motion is now used only for the nav pill, the tab underline, the project list and wizard transitions.

## How motion is kept cheap

- Loops (floating cards, clouds, swaying flowers, skeleton) are CSS keyframes on `transform` only. `will-change: transform` is set only on the hero floating cards (`.floating`).
- Loops pause when off screen (a shared IntersectionObserver sets `data-offscreen`) and when the tab is hidden (`html[data-page-hidden]`).
- Reveals are CSS transitions on `opacity` and `transform`, triggered once by an IntersectionObserver. Without scripting, nothing stays hidden.
- Count-up is a CSS animation on an integer property: no per-frame JavaScript. The only per-frame-style script is the scroll parallax (max 24 px), throttled with `requestAnimationFrame`.
- Buttons, cards, chips and links animate through CSS only (the button no longer ships framer-motion). The hover glow and the card shadow are opacity layers, never animated `box-shadow`.
- `prefers-reduced-motion: reduce` switches off every loop, reveal, count-up, word reveal, parallax and hover movement. The overlap audit runs in this mode, and the pages stay fully usable.
- On phones the hero shows 3 floating cards and clouds use shorter travel.

## Re-measure

```bash
node scripts/prod-local.mjs                     # builds to .next-perf and serves on :3200
E2E_BASE_URL=http://localhost:3200 pnpm perf    # PERF_RUNS=5 PERF_DEBUG=1 for more runs and the LCP element
```
