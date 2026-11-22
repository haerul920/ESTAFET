# Performance (phase R3 & R8)

Targets (CLAUDE.md 14.8 and 14.10): CLS under 0.05, LCP under 2.5 s on a mid-range phone for Home and Explore, animations only on `transform` and `opacity`, loops paused off screen.

## Measured numbers (Phase R8 — Production Build against Local Stack)

Measured with `scripts/perf-check.ts` against a **production build** (`NEXT_DIST_DIR=.next-prod`, `next build` then `next start -p 3100`, local Supabase stack `.env.localstack`, demo data), in headless Chromium with a mid-range phone profile: 390x844 at 2x, CPU 4x slower, 1.6 Mbps down, 150 ms round trip. Median of 3 runs, Indonesian pages, no cache.

| Page | LCP (median) | CLS (median) | JavaScript (uncompressed) | Transferred (uncompressed) |
|---|---|---|---|---|
| Home (id) (`/`) | 1.22 s | 0.011 | 862 KB | 1218 KB |
| Explore (id) (`/explore`) | 2.46 s | 0.000 | 861 KB | 4565 KB |
| Project teaser (id) (`/projects/mangrove-cover-classifier`) | 3.14 s | 0.000 | 884 KB | 1222 KB |
| Login (id) (`/login`) | 0.95 s | 0.000 | 857 KB | 1157 KB |
| Share / Wizard redirect (id) (`/bagikan`) | 1.12 s | 0.000 | 857 KB | 1158 KB |

### Baseline comparison (Phase R3 initial measurement)

| Page | LCP | CLS | JavaScript (uncompressed) | Transferred (uncompressed) |
|---|---|---|---|---|
| Home | 1.34 s | 0.000 | 853 KB | 1134 KB |
| Explore | 1.08 s | 0.000 | 853 KB | 1226 KB |

Both are under the targets. LCP is read **before** scrolling (a first version of the script scrolled first, which made a heading far down the page count as LCP and gave a false 8.8 s; that was a measuring mistake, not a page problem).

## Navigation feedback (loading states, R9)

Every page is dynamic (it reads the session cookie), so Next.js cannot prefetch a whole page. Without a `loading.tsx`
the browser waits for the server to render the next page before anything changes. Every route folder with a page now
has a `loading.tsx` (shared shapes in `src/components/ui/PageSkeleton.tsx`, admin in `src/components/admin/AdminSkeleton.tsx`).
Next wraps the page in `<Suspense>` with it and prefetches the skeleton, so a click switches the page at once and the
content streams in. The home page sits in its own route group, `(public)/(home)`, so its skeleton also appears when coming
from another public page. The wizard steps (`/bagikan/[id]/[step]`) have no skeleton on purpose: they move after a save,
with the button's pending state and the wizard's own transition.

Measured on a local production build against the local stack, Chromium, desktop, clicking links on public pages
(22 November 2026). "Slow server" adds 1.5 s to each page render in the browser to imitate a slow host.

| Click to | Page switched, normal | Content shown, normal | Page switched, slow server | Content shown, slow server |
|---|---|---|---|---|
| Project teaser | 148 ms | 211 ms | 76 ms | 1644 ms |
| Contact | 90 ms | 134 ms | 45 ms | 1565 ms |
| Terms | 50 ms | 355 ms | 48 ms | 1607 ms |
| Explore | 99 ms | 523 ms | 78 ms | 1943 ms |
| Sign in | 86 ms | 121 ms | 114 ms | 1643 ms |
| Home | 73 ms | 160 ms | 65 ms | (not measured) |

Before this change the home page, with the slow server, switched only after 1604 ms. Not measured: signed-in and
admin pages (the production build sends `upgrade-insecure-requests`, so signing in over plain http on localhost fails),
a real phone, a real network. **In `pnpm dev` there is no prefetching and every page compiles on first visit, so
navigation there stays slower; judge speed on a production build.**

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
pnpm build && pnpm start                        # production build on :3000, using .env.local
E2E_BASE_URL=http://localhost:3000 pnpm perf    # PERF_RUNS=5 PERF_DEBUG=1 for more runs and the LCP element
```
