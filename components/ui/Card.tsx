import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type CardOwnProps<E extends ElementType> = {
  as?: E;
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  padding?: "default" | "loose" | "none";
  glow?: "accent" | "accent-2";
};

type CardProps<E extends ElementType> = CardOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof CardOwnProps<E>>;

const PADDING = {
  default: "px-4 py-3",
  loose: "p-4",
  none: "",
};

const GLOW_MAP = {
  accent: "shadow-[0_0_24px_-8px_var(--accent-glow)]",
  "accent-2": "shadow-[0_0_24px_-8px_var(--accent-2-glow)]",
} as const;

export function Card<E extends ElementType = "div">({
  as,
  children,
  className,
  interactive = false,
  padding = "default",
  glow,
  ...rest
}: CardProps<E>) {
  const Component = (as ?? "div") as ElementType;
  // `block` is essential: cards are often rendered `as={Link}` (an <a>, which
  // defaults to display:inline). Without it, a card with inline content flows
  // horizontally instead of stacking — which blew the journal layout out to
  // thousands of px wide. Forcing block makes every polymorphic card behave.
  const base = "block rounded-lg border border-border bg-surface";
  const pad = PADDING[padding];
  const hover = interactive
    ? "shadow-sm motion-safe:transition-all motion-safe:duration-150 motion-safe:ease-out hover:-translate-y-px hover:border-border-soft hover:bg-surface-2 hover:shadow-[0_10px_30px_-14px_rgba(0,0,0,0.7),0_0_24px_-10px_var(--accent-glow)]"
    : "";
  const glowCls = glow ? GLOW_MAP[glow] : "";
  return (
    <Component
      className={[base, pad, hover, glowCls, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </Component>
  );
}
