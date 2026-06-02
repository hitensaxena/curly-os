import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent focus-visible:ring-offset-1 " +
  "focus-visible:ring-offset-background " +
  "disabled:cursor-not-allowed disabled:opacity-40 " +
  "motion-safe:transition-[transform,opacity,background-color,box-shadow] active:scale-[0.97]";

const SIZES: Record<ButtonSize, string> = {
  // Touch-target safe: ~36px tall sm, ~40px tall md.
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-10 px-4 text-sm",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-fg hover:opacity-90 active:opacity-100 " +
    "shadow-[0_0_0_1px_var(--accent-soft),0_0_20px_-6px_var(--accent-glow)] " +
    "hover:shadow-[0_0_24px_-4px_var(--accent-glow)]",
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
    loading = false,
    disabled,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent"
          style={{ animation: "spin 0.7s linear infinite" }}
          aria-hidden="true"
        />
      ) : (
        leadingIcon
      )}
      {children ? <span>{children}</span> : null}
      {trailingIcon}
    </button>
  );
});
