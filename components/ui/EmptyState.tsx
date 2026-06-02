import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

export function EmptyState({
  title,
  body,
  action,
  logoSize = "md",
  className,
  tone = "default",
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  logoSize?: "sm" | "md" | "lg";
  className?: string;
  tone?: "default" | "warm";
}) {
  const logoGlowCls =
    tone === "warm"
      ? "opacity-60 [filter:drop-shadow(0_0_12px_var(--accent-3-glow))]"
      : "opacity-60";

  return (
    <div
      className={[
        "flex flex-col items-center gap-3 px-4 py-10 text-center",
        "motion-safe:animate-[cardin_0.35s_var(--ease-out)_both]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Logo size={logoSize} className={logoGlowCls} />
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
