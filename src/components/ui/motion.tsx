"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { observeLoop } from "@/lib/loop-observer";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

/*
 * Motion primitives (CLAUDE.md 14.8). Loops and reveals are CSS (src/styles/motion.css).
 * JavaScript only decides when something is in view, and drives the scroll parallax with
 * requestAnimationFrame. Everything is off when the visitor prefers reduced motion.
 */

type Vars = CSSProperties & Record<`--${string}`, string | number | undefined>;

/** Marks `data-in` once the element enters the viewport (once). */
function useInViewOnce<T extends HTMLElement>(margin = "-60px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Browsers without IntersectionObserver are not supported for reveals: the CSS shows content when
    // scripting is unavailable, and every current browser has IntersectionObserver.
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: `0px 0px ${margin} 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, inView] as const;
}

/** Fades and lifts its children into view once. `delay` is in seconds. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "aside";
}) {
  const [ref, inView] = useInViewOnce<HTMLElement>();
  return (
    <Tag
      ref={ref as never}
      data-in={inView}
      className={cn("reveal", className)}
      style={{ "--delay": `${Math.round(delay * 1000)}ms`, "--reveal-y": `${y}px` } as Vars}
    >
      {children}
    </Tag>
  );
}

/** Container whose <StaggerItem> children enter one after another when it scrolls into view. `gap` is in seconds. */
export function Stagger({
  children,
  gap = 0.08,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  gap?: number;
  className?: string;
  as?: "div" | "ul" | "ol" | "section";
}) {
  const [ref, inView] = useInViewOnce<HTMLElement>();
  return (
    <Tag ref={ref as never} data-in={inView} className={cn("stagger", className)} style={{ "--gap": `${Math.round(gap * 1000)}ms` } as Vars}>
      {children}
    </Tag>
  );
}

export function StaggerItem({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
}) {
  return <Tag className={cn("reveal-item", className)}>{children}</Tag>;
}

/** Splits a headline into words that rise in one after another. Screen readers get the whole sentence once. */
export function WordReveal({ text, baseDelay = 100, className }: { text: string; baseDelay?: number; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <span key={`${w}-${i}`}>
            <span className="word" style={{ "--i": i, "--base": `${baseDelay}ms` } as Vars}>
              {w}
            </span>
            {i < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Counts up to a number once, when it scrolls into view. CSS animates an integer property,
 * so there is no per-frame JavaScript. The final value is always in the accessible name.
 */
export function CountUp({ to, suffix = "", className }: { to: number; suffix?: string; className?: string }) {
  const [ref, inView] = useInViewOnce<HTMLSpanElement>("-40px");
  const reduce = usePrefersReducedMotion();
  const [supported] = useState(() => typeof CSS !== "undefined" && "registerProperty" in CSS);
  const staticFinal = reduce || !supported;
  const final = `${to}${suffix}`;
  return (
    <span className={className}>
      <span className="sr-only">{final}</span>
      <span
        ref={ref}
        aria-hidden="true"
        className="count-up"
        data-in={inView}
        data-static={staticFinal}
        style={{ "--to": to, "--suffix": JSON.stringify(suffix), "--final": JSON.stringify(final) } as Vars}
      />
    </span>
  );
}

/** A progress bar whose fill grows to the given percentage (transform only). */
export function AnimatedBar({
  pct,
  height = 8,
  track = "#E1E5E9",
  fill = "#1760D6",
  label,
  className,
}: {
  pct: number;
  height?: number;
  track?: string;
  fill?: string;
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const [ref, inView] = useInViewOnce<HTMLDivElement>("-20px");
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("overflow-hidden rounded-full", className)}
      style={{ height, background: track }}
    >
      <div
        className="h-full w-full origin-left rounded-full"
        style={{
          background: fill,
          transform: `scaleX(${inView ? clamped / 100 : 0})`,
          transition: "transform 900ms var(--ease)",
        }}
      />
    </div>
  );
}

/** Starts and stops looping CSS animation on an element depending on visibility. */
function useLoop<T extends Element>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    return el ? observeLoop(el as unknown as HTMLElement) : undefined;
  }, []);
  return ref;
}

/** A blurred white ellipse that drifts slowly (40 to 70 s). Decorative. Needs a positioned parent. */
export function Cloud({
  className,
  drift = 60,
  duration = 55,
  depth = 1,
  delay = 0,
}: {
  className?: string;
  /** Horizontal travel in px either side of the start. */
  drift?: number;
  /** Seconds, one direction. Keep between 40 and 70. */
  duration?: number;
  /** Scroll parallax multiplier. */
  depth?: number;
  delay?: number;
}) {
  const ref = useLoop<HTMLDivElement>();
  return (
    <div aria-hidden="true" className={cn("parallax pointer-events-none absolute", className)} style={{ "--depth": depth } as Vars}>
      <div
        ref={ref}
        data-loop
        className="cloud-drift h-full w-full rounded-full bg-white"
        style={{ "--drift": `${drift}px`, "--dur": `${duration}s`, "--delay": `${-delay}s` } as Vars}
      />
    </div>
  );
}

/**
 * A card that floats: its own duration (6 to 9 s), amplitude (8 to 16 px), slight rotation and delay.
 * The wrapper reserves no space of its own, so the parent must leave room for `amplitude`.
 */
export function Floating({
  children,
  duration = 7,
  amplitude = 12,
  rotate = 1.5,
  delay = 0,
  className,
}: {
  children: ReactNode;
  duration?: number;
  amplitude?: number;
  rotate?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useLoop<HTMLDivElement>();
  return (
    <div
      ref={ref}
      data-loop
      className={cn("floating", className)}
      style={
        {
          "--dur": `${duration}s`,
          "--amp": `${amplitude}px`,
          "--rot-a": `${-rotate}deg`,
          "--rot-b": `${rotate}deg`,
          "--delay": `${-delay}s`,
        } as Vars
      }
    >
      {children}
    </div>
  );
}

/** An element in an SVG that sways (flowers). Pauses off screen. */
export function SwayGroup({ children, duration = 4, delay = 0, angle = 3 }: { children: ReactNode; duration?: number; delay?: number; angle?: number }) {
  const ref = useLoop<SVGGElement>();
  return (
    <g ref={ref} data-loop className="sway" style={{ "--dur": `${duration}s`, "--delay": `${-delay}s`, "--sway": `${angle}deg` } as Vars}>
      {children}
    </g>
  );
}

/**
 * Sets --py (0 to 24 px) on its own element while the page scrolls, throttled with requestAnimationFrame.
 * Children use the .parallax class (Cloud does). Does nothing when reduced motion is on.
 */
export function ParallaxLayer({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      el.style.setProperty("--py", `${Math.min(24, window.scrollY * 0.04).toFixed(1)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduce]);
  return (
    <div ref={ref} aria-hidden="true" className={cn("pointer-events-none absolute inset-0", className)}>
      {children}
    </div>
  );
}
