import type { ReactNode } from "react";

export type ToastVariant = "info" | "success" | "danger";

const RING: Record<ToastVariant, string> = {
  info: "border-border bg-surface text-foreground",
  success: "border-success/40 bg-success/10 text-foreground",
  danger: "border-danger/40 bg-danger/10 text-foreground",
};

export function Toast({
  variant = "info",
  children,
  className,
}: {
  variant?: ToastVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-md border px-3 py-2 text-sm",
        RING[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
