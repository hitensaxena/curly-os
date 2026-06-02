import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type CardOwnProps<E extends ElementType> = {
  as?: E;
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  padding?: "default" | "loose" | "none";
};

type CardProps<E extends ElementType> = CardOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof CardOwnProps<E>>;

const PADDING = {
  default: "px-4 py-3",
  loose: "p-4",
  none: "",
};

export function Card<E extends ElementType = "div">({
  as,
  children,
  className,
  interactive = false,
  padding = "default",
  ...rest
}: CardProps<E>) {
  const Component = (as ?? "div") as ElementType;
  const base = "rounded-lg border border-border bg-surface";
  const pad = PADDING[padding];
  const hover = interactive
    ? "shadow-sm motion-safe:transition-all motion-safe:duration-150 motion-safe:ease-out hover:-translate-y-px hover:border-border-soft hover:bg-surface-2 hover:shadow-md"
    : "";
  return (
    <Component
      className={[base, pad, hover, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </Component>
  );
}
