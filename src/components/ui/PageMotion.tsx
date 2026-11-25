"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** False until the first page has mounted: that one is already on screen, so hiding it would make it blink. */
let arrivedByNavigation = false;

/** Blocks that bring their own GSAP reveal are left alone, so nothing is animated twice. */
const OWN_REVEAL = ".reveal, .stagger, .reveal-item";

function pageBlocks(main: HTMLElement): HTMLElement[] {
  const visible = (el: Element): el is HTMLElement => el instanceof HTMLElement && el.offsetHeight > 0;
  let blocks = [...main.children].filter(visible);
  // A page with a single wrapper: animate what is inside it.
  while (blocks.length === 1 && blocks[0].children.length > 1) blocks = [...blocks[0].children].filter(visible);
  return blocks.filter((el) => !el.matches(OWN_REVEAL) && !el.querySelector(OWN_REVEAL));
}

/**
 * Gives every page in PageShell the same GSAP + ScrollTrigger entrance: blocks rise in when they are
 * scrolled into view. After a navigation, the blocks already on screen enter too. On the first load they
 * stay put. Does nothing for loading skeletons or when the visitor asked for less motion.
 */
export function PageMotion() {
  const marker = useRef<HTMLSpanElement>(null);
  const reduce = usePrefersReducedMotion();

  useBrowserLayoutEffect(() => {
    const main = marker.current?.parentElement;
    const navigated = arrivedByNavigation;
    arrivedByNavigation = true;
    if (!main || reduce || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (main.querySelector('[aria-busy="true"][role="status"]')) return;

    const blocks = pageBlocks(main).filter((el) => navigated || el.getBoundingClientRect().top > window.innerHeight);
    if (blocks.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.set(blocks, { opacity: 0, y: 24 });
      ScrollTrigger.batch(blocks, {
        start: "top 92%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.08,
            ease: "power3.out",
            overwrite: true,
            // Leave no transform behind: it would trap fixed and sticky elements inside the block.
            clearProps: "transform,opacity",
          }),
      });
    }, main);
    return () => ctx.revert();
  }, [reduce]);

  return <span ref={marker} hidden />;
}
