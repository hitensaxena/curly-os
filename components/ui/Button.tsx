import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent focus-visible:ring-offset-1 " +
  "focus-visible:ring-offset-background " +
  "disabled:cursor-not-allowed disabled:opacity-40";

const SIZES: Record<ButtonSize, string> = {
  // Touch-target safe: ~36px tall sm, ~40px tall md.
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-10 px-4 text-sm",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-fg hover:opacity-90 active:opacity-100",
  secondary:
    "border border-border bg-surface text-foreground " +
    "hover:bg-surface-2 active:bg-surface-3",
  ghost:
    "text-foreground hover:bg-surface-2 active:bg-surface-3",
  danger:
    "bg-danger text-white hover:opacity-90 active:opacity-100",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string
): string {
  return [BASE, SIZES[size], VARIANTS[variant], extra]
    .filter(Boolean)
    .join(" ");
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    leadingIcon,
    trailingIcon,
    className,
    children,
    type = "button",
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {leadingIcon}
      {children ? <span>{children}</span> : null}
      {trailingIcon}
    </button>
  );
});
