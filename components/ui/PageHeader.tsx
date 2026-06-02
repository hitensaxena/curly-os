import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  compact = false,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const pad = compact ? "px-4 py-3 sm:px-6" : "px-4 py-4 sm:px-6";
  return (
    <header
      className={[
        "flex items-start justify-between gap-3 border-b border-border bg-surface",
        pad,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0">
        <h1
          className={
            compact
              ? "text-sm font-semibold text-foreground"
              : "text-base font-semibold text-foreground"
          }
        >
          {title}
        </h1>
        {subtitle ? (
          <div className="mt-0.5 text-xs text-muted">{subtitle}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
