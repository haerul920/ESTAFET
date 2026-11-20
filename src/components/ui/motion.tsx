"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type Variants } from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts its children into view once. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "aside";
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

const staggerParent = (gap: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: 0.05 } },
});
const staggerChild: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

/** Container whose <StaggerItem> children animate in one after another when scrolled into view. */
export function Stagger({
  children,
  gap = 0.08,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  gap?: number;
  className?: string;
  as?: "div" | "ul" | "ol" | "section";
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      variants={staggerParent(gap)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
    >
      {children}
    </Tag>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li" | "article" | "a";
}) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag className={className} variants={staggerChild}>
      {children}
    </Tag>
  );
}

/** Counts up to a number when it scrolls into view. */
export function CountUp({ to, suffix = "", className }: { to: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const value = useMotionValue(reduce ? to : 0);
  const rounded = useTransform(value, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(value, to, { duration: 1.2, ease: EASE });
    return () => controls.stop();
  }, [inView, reduce, to, value]);

  return (
    <motion.span ref={ref} className={className}>
      {rounded}
    </motion.span>
  );
}

/** A progress bar whose fill animates to the given percentage. */
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
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("overflow-hidden rounded-full", className)}
      style={{ height, background: track }}
    >
      <motion.div
        className="rounded-full"
        style={{ height, background: fill }}
        initial={{ width: 0 }}
        whileInView={{ width: `${clamped}%` }}
        viewport={{ once: true }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.9, ease: EASE }}
      />
    </div>
  );
}

/** A blurred white ellipse that drifts slowly. Decorative only. */
export function Cloud({
  className,
  style,
  drift = 18,
  duration = 14,
}: {
  className?: string;
  style?: React.CSSProperties;
  drift?: number;
  duration?: number;
}) {
  return (
    <motion.div
      aria-hidden="true"
      className={cn("pointer-events-none absolute rounded-full bg-white", className)}
      style={style}
      animate={{ x: [0, drift, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/** Gentle vertical float for hero preview cards. */
export function Float({
  children,
  delay = 0,
  amount = 8,
  className,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  amount?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      animate={{ y: [0, -amount, 0] }}
      transition={{ duration: 6 + delay, repeat: Infinity, ease: "easeInOut", delay }}
    >
      {children}
    </motion.div>
  );
}

/** Wraps a card so it lifts on hover. */
export function HoverLift({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
    >
      {children}
    </motion.div>
  );
}
