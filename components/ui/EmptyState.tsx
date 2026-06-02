import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

export function EmptyState({
  title,
  body,
  action,
  logoSize = "md",
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  logoSize?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div
      className={[
        "flex flex-col items-center gap-3 px-4 py-10 text-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Logo size={logoSize} className="opacity-60" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {body ? (
          <p className="mx-auto max-w-sm text-xs text-muted">{body}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
