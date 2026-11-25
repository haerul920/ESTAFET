"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/cn";
import { observeLoop } from "@/lib/loop-observer";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/*
 * Who animates what (CLAUDE.md 15.3). One owner per element and property, so two systems never fight:
 *  - GSAP + ScrollTrigger: scroll reveals, staggers, the headline, count-ups, progress bars, parallax.
 *  - Motion (the framer-motion package): hover, press, enter and exit, layout changes.
 *  - CSS: endless loops (clouds, flowers, skeletons) and tiny states (link underline, colours, chips).
 * Everything respects prefers-reduced-motion.
 */

type Vars = CSSProperties & Record<`--${string}`, string | number | undefined>;

/** Fades and lifts its children into view once via GSAP + ScrollTrigger. `delay` is in seconds. */
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
  const ref = useRef<HTMLElement>(null);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.dataset.in = "true";
      gsap.set(el, { clearProps: "all" });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(el, { opacity: 0, y });
      ScrollTrigger.create({
        trigger: el,
        start: "top 92%",
        once: true,
        onEnter: () => {
          el.dataset.in = "true";
          gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 0.65,
            delay,
            ease: "power3.out",
            clearProps: "transform,opacity",
          });
        },
      });
    }, el);
    return () => ctx.revert();
  }, [delay, reduce, y]);

  return (
    <Tag
      ref={ref as never}
      data-in={reduce ? true : undefined}
      className={cn("reveal", className)}
      style={{ "--delay": `${Math.round(delay * 1000)}ms`, "--reveal-y": `${y}px` } as Vars}
    >
      {children}
    </Tag>
  );
}

/** Container whose <StaggerItem> children enter one after another via GSAP + ScrollTrigger. `gap` is in seconds. */
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
  const ref = useRef<HTMLElement>(null);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>(":scope > .reveal-item");
    if (reduce || items.length === 0) {
      el.dataset.in = "true";
      if (items.length > 0) gsap.set(items, { clearProps: "all" });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(items, { opacity: 0, y: 22 });
      ScrollTrigger.create({
        trigger: el,
        start: "top 92%",
        once: true,
        onEnter: () => {
          el.dataset.in = "true";
          gsap.to(items, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: gap,
            ease: "power3.out",
            clearProps: "transform,opacity",
          });
        },
      });
    }, el);
    return () => ctx.revert();
  }, [gap, reduce]);

  return (
    <Tag
      ref={ref as never}
      data-in={reduce ? true : undefined}
      className={cn("stagger", className)}
      style={{ "--gap": `${Math.round(gap * 1000)}ms` } as Vars}
    >
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
  // GSAP owns this element's transform. A card that needs a hover lift wraps its content in <HoverLift>.
  return <Tag className={cn("reveal-item", className)}>{children}</Tag>;
}

/** Splits a headline into words that rise in one after another via a GSAP timeline. Screen readers get the whole sentence once. */
export function WordReveal({
  text,
  baseDelay = 100,
  className,
}: {
  text: string;
  baseDelay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = usePrefersReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The words start hidden by CSS. Every path out of here has to switch that off, or the headline stays blank.
    if (reduce) {
      el.dataset.in = "true";
      return;
    }
    const targets = el.querySelectorAll<HTMLElement>(".word");
    if (targets.length === 0) return;
    const ctx = gsap.context(() => {
      // From here on GSAP sets each word's opacity, so the CSS that hid them before it ran is switched off.
      el.dataset.in = "true";
      gsap.fromTo(
        targets,
        { opacity: 0, y: "0.45em" },
        {
          opacity: 1,
          y: "0em",
          duration: 0.55,
          stagger: 0.055,
          delay: baseDelay / 1000,
          ease: "power3.out",
          clearProps: "transform,opacity",
        },
      );
    }, el);
    return () => ctx.revert();
  }, [baseDelay, reduce, text]);

  return (
    <span ref={ref} className={cn("word-reveal", className)}>
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
 * Counts up to a number once when scrolled into view using GSAP + ScrollTrigger.
 * Mutates textContent directly on each GSAP tick to avoid React re-renders.
 */
export function CountUp({ to, suffix = "", className }: { to: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = usePrefersReducedMotion();
  const final = `${to}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = final;
      return;
    }
    const counter = { val: 0 };
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start: "top 94%",
        once: true,
        onEnter: () => {
          gsap.to(counter, {
            val: to,
            duration: 1.1,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = `${Math.round(counter.val)}${suffix}`;
            },
            onComplete: () => {
              el.textContent = final;
            },
          });
        },
      });
    }, el);
    return () => ctx.revert();
  }, [final, reduce, suffix, to]);

  return (
    <span className={className}>
      <span className="sr-only">{final}</span>
      <span ref={ref} aria-hidden="true">
        {final}
      </span>
    </span>
  );
}

/** A progress bar whose fill grows to the given percentage via GSAP + ScrollTrigger. */
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
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const trackEl = trackRef.current;
    const fillEl = fillRef.current;
    if (!trackEl || !fillEl) return;
    if (reduce) {
      gsap.set(fillEl, { scaleX: clamped / 100 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        fillEl,
        { scaleX: 0 },
        {
          scaleX: clamped / 100,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: {
            trigger: trackEl,
            start: "top 95%",
            once: true,
          },
        },
      );
    }, trackEl);
    return () => ctx.revert();
  }, [clamped, reduce]);

  return (
    <div
      ref={trackRef}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("overflow-hidden rounded-full", className)}
      style={{ height, background: track }}
    >
      <div
        ref={fillRef}
        className="h-full w-full origin-left rounded-full"
        style={{
          background: fill,
          transform: `scaleX(${clamped / 100})`,
        }}
      />
    </div>
  );
}

/** Motion hover lift for cards and feature blocks: 4 px up, a small press. */
export function HoverLift({
  children,
  className,
  y = -4,
  scale = 1,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  scale?: number;
}) {
  const reduce = usePrefersReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={reduce ? undefined : { y, scale }}
      whileTap={reduce ? undefined : { scale: 0.99 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
    >
      {children}
    </motion.div>
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
    <div
      aria-hidden="true"
      className={cn("parallax pointer-events-none absolute", className)}
      style={{ "--depth": depth } as Vars}
    >
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
export function SwayGroup({
  children,
  duration = 4,
  delay = 0,
  angle = 3,
}: {
  children: ReactNode;
  duration?: number;
  delay?: number;
  angle?: number;
}) {
  const ref = useLoop<SVGGElement>();
  return (
    <g
      ref={ref}
      data-loop
      className="sway"
      style={{ "--dur": `${duration}s`, "--delay": `${-delay}s`, "--sway": `${angle}deg` } as Vars}
    >
      {children}
    </g>
  );
}

/**
 * Scrubs --py (0 to 24 px) on its own element while the page scrolls using GSAP + ScrollTrigger.
 * Children use the .parallax class (Cloud does). Does nothing when reduced motion is on.
 */
export function ParallaxLayer({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { "--py": "0px" },
        {
          "--py": "24px",
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
          },
        },
      );
    }, el);
    return () => ctx.revert();
  }, [reduce]);
  return (
    <div ref={ref} aria-hidden="true" className={cn("pointer-events-none absolute inset-0", className)}>
      {children}
    </div>
  );
}
