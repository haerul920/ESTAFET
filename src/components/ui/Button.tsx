"use client";

import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

export type ButtonVariant = "primary" | "dark" | "darkSolid" | "outline" | "outlineBlue" | "danger" | "ghost" | "white";
export type ButtonSize = "sm" | "md" | "lg";

const MotionLink = motion.create(Link);

interface Shared {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Show the black arrow circle (primary lime pill by default for sm and lg). */
  arrow?: boolean;
  /** Soft glow on hover (hero calls to action). */
  glow?: boolean;
  className?: string;
  children: React.ReactNode;
}

function styles(variant: ButtonVariant, size: ButtonSize, arrow: boolean, glow = false) {
  const mono = size !== "md";
  const base = cn(
    "btn relative inline-flex select-none items-center justify-center gap-2.5 whitespace-nowrap rounded-full font-semibold no-underline",
    glow && "btn-glow",
    "disabled:cursor-not-allowed disabled:opacity-70",
    mono ? "mono-label" : "text-[15px]",
    size === "sm" && "min-h-[44px] text-[12.5px]",
    size === "lg" && "min-h-[52px] text-[13px]",
    size === "md" && "min-h-[44px] text-[15px]",
  );
  const pad =
    arrow && (variant === "primary" || variant === "darkSolid")
      ? size === "sm"
        ? "py-[6px] pl-[18px] pr-[6px]"
        : "py-2 pl-6 pr-2"
      : size === "lg"
        ? "px-7 py-3.5"
        : size === "sm"
          ? "px-5 py-2.5"
          : "px-6 py-3";
  const tone: Record<ButtonVariant, string> = {
    primary: "bg-lime text-black hover:brightness-95 disabled:bg-line disabled:text-text-2",
    dark: "border border-white/25 bg-[rgba(10,45,100,0.55)] text-white hover:bg-[rgba(10,45,100,0.7)]",
    darkSolid: "bg-black text-white hover:bg-ink",
    outline: "border-[1.5px] border-line-strong bg-white text-ink hover:bg-surface",
    outlineBlue: "border-[1.5px] border-blue bg-white text-blue hover:bg-blue-tint",
    danger: "border-[1.5px] border-danger bg-white text-danger hover:bg-[#fdecea]",
    ghost: "bg-transparent text-blue hover:bg-blue-tint",
    white: "bg-white text-black shadow-[0_10px_30px_rgba(120,70,40,0.2)] hover:bg-white/90",
  };
  return cn(base, pad, tone[variant]);
}

function ArrowCircle({ variant, size }: { variant: ButtonVariant; size: ButtonSize }) {
  const dark = variant === "darkSolid";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "btn-arrow flex items-center justify-center rounded-full",
        size === "sm" ? "h-[30px] w-[30px]" : "h-9 w-9",
        dark ? "bg-lime" : "bg-black",
      )}
    >
      <ArrowUpRight size={size === "sm" ? 14 : 16} strokeWidth={2.5} className={dark ? "text-black" : "text-lime"} />
    </span>
  );
}

type ButtonProps = Shared & {
  /** Shows an inline loading spinner and disables the button while an action is running. */
  loading?: boolean;
} & Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "children" | "className" | "onAnimationStart" | "onDrag" | "onDragEnd" | "onDragStart"
  >;

export function Button({
  variant = "primary",
  size = "md",
  arrow,
  glow,
  loading,
  className,
  children,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  const { pending: formPending } = useFormStatus();
  const isLoading = Boolean(loading || (type === "submit" && formPending));
  const isDisabled = Boolean(disabled) || isLoading;
  const showArrow = (arrow ?? false) && !isLoading;
  const reduce = usePrefersReducedMotion();
  const inactive = reduce || isDisabled;
  // A menu trigger gets no Motion press: on Enter, Motion fires a synthetic pointerdown that would close
  // the menu again as soon as it opens.
  const opensMenu = rest["aria-haspopup"] === "menu";
  return (
    <motion.button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={cn(styles(variant, size, showArrow, glow), className)}
      whileHover={inactive ? undefined : { y: -2, scale: 1.015 }}
      whileTap={inactive || opensMenu ? undefined : { y: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 460, damping: 26, mass: 0.6 }}
      {...rest}
    >
      {isLoading ? <Loader2 size={size === "sm" ? 15 : 17} className="animate-spin" aria-hidden="true" /> : null}
      {children}
      {showArrow ? <ArrowCircle variant={variant} size={size} /> : null}
    </motion.button>
  );
}

type ButtonLinkProps = Shared & {
  href: string;
  prefetch?: boolean;
  scroll?: boolean;
  replace?: boolean;
  target?: string;
  rel?: string;
  download?: boolean | string;
  "aria-label"?: string;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  arrow,
  glow,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  const showArrow = arrow ?? false;
  const reduce = usePrefersReducedMotion();
  const cls = cn(styles(variant, size, showArrow, glow), className);
  const hoverProps = reduce
    ? {}
    : {
        whileHover: { y: -2, scale: 1.015 },
        whileTap: { y: 0, scale: 0.98 },
        transition: { type: "spring" as const, stiffness: 460, damping: 26, mass: 0.6 },
      };

  // API routes (downloads, PDFs) are not pages: they must not get a language prefix, so they use a plain anchor.
  if (rest.href.startsWith("/api/")) {
    const { href, download, target, rel, "aria-label": ariaLabel } = rest;
    return (
      <motion.a
        className={cls}
        href={href}
        download={download}
        target={target}
        rel={rel}
        aria-label={ariaLabel}
        {...hoverProps}
      >
        {children}
        {showArrow ? <ArrowCircle variant={variant} size={size} /> : null}
      </motion.a>
    );
  }
  return (
    <MotionLink className={cls} {...hoverProps} {...rest}>
      {children}
      {showArrow ? <ArrowCircle variant={variant} size={size} /> : null}
    </MotionLink>
  );
}
