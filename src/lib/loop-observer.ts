/**
 * Looping animations (floating cards, drifting clouds, swaying flowers) pause while they are off screen.
 * One shared IntersectionObserver marks each element with data-offscreen, and CSS pauses it
 * (see src/styles/motion.css). The tab-hidden case is handled by MotionRuntime.
 */
let observer: IntersectionObserver | null = null;

function get(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) (e.target as HTMLElement).dataset.offscreen = e.isIntersecting ? "false" : "true";
    },
    { rootMargin: "80px" },
  );
  return observer;
}

/** Starts watching an element. Returns a cleanup function. */
export function observeLoop(el: HTMLElement): () => void {
  const o = get();
  if (!o) return () => {};
  o.observe(el);
  return () => o.unobserve(el);
}
