import type { ReactNode } from "react";

/**
 * PageHeading — consistent page-level heading treatment.
 *
 * Matches the hand-rolled inline pattern used across the workspace:
 * max-w wrapper + padding, h1 with text-glow, optional eyebrow, muted subtitle,
 * and an optional actions slot on the right.
 *
 * Server-safe (no hooks / 'use client').
 */
export function PageHeading({
  title,
  subtitle,
  eyebrow,
  actions,
  tone = "default",
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  tone?: "default" | "warm";
}) {
  const titleGlow = tone === "warm" ? "text-glow-2" : "text-glow";
  const eyebrowColor =
    tone === "warm" ? "text-[color:var(--accent-warm)]" : "text-accent-2";

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p
            className={`mb-1 text-[10px] font-semibold uppercase tracking-widest ${eyebrowColor}`}
          >
            {eyebrow}
          </p>
        )}
        <h1 className={`text-2xl font-semibold text-foreground ${titleGlow}`}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
