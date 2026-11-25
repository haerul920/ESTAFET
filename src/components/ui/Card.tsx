import { cn } from "@/lib/cn";

type Tone = "surface" | "white" | "lime" | "blue" | "warn" | "grey" | "dashed";

const TONE: Record<Tone, string> = {
  surface: "bg-surface border border-surface",
  white: "bg-white border border-line-soft",
  lime: "bg-white border-2 border-lime",
  blue: "bg-blue-tint border border-blue-tint",
  warn: "bg-warn-bg border border-warn-bg",
  grey: "bg-surface-grey border border-surface-grey",
  dashed: "bg-chip border border-dashed border-line-strong",
};

export function Card({
  tone = "surface",
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  tone?: Tone;
  as?: "div" | "section" | "aside" | "article" | "li";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("rounded-[28px] p-6 max-sm:rounded-[22px] max-sm:p-4", TONE[tone], className)} {...rest}>
      {children}
    </Tag>
  );
}
