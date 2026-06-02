"use client";

import { useEffect, useRef } from "react";
import {
  type BloomState,
  renderSettled,
  stateDuration,
  tickState,
} from "@/lib/bloom-mark";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = {
  xs: 16,
  sm: 24,
  md: 40,
  lg: 96,
  xl: 160,
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AnimatedLogo({
  state,
  size = "md",
  className,
  ariaLabel = "Mintrix Bloom mark",
  onComplete,
}: {
  state: BloomState;
  size?: Size;
  className?: string;
  ariaLabel?: string;
  /** Fires once when a one-shot state finishes. Ignored for loops. */
  onComplete?: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number | null>(null);
  const startMsRef = useRef<number>(0);
  const px = SIZE_PX[size];

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    if (prefersReducedMotion()) {
      // Respect reduced-motion: render a single representative frame.
      if (state === "success" || state === "error" || state === "reveal") {
        // Pick a frame mid-hold for one-shots so the meaning is visible.
        const frameMs = state === "error" ? 1500 : 700;
        tickState(svg, state, frameMs, px);
        onComplete?.();
      } else {
        renderSettled(svg, px);
      }
      return;
    }

    startMsRef.current = performance.now();
    let active = true;

    const tick = () => {
      if (!active) return;
      const elapsed = performance.now() - startMsRef.current;
      const keepGoing = tickState(svg, state, elapsed, px);
      if (!keepGoing) {
        onComplete?.();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // Re-bind when state changes — restart the timer from zero.
  }, [state, px, onComplete]);

  // `stateDuration` is referenced so it's still part of the module's
  // public surface for callers that want to schedule transitions.
  void stateDuration;

  return (
    <svg
      ref={svgRef}
      width={px}
      height={px}
      viewBox="0 0 240 240"
      aria-label={ariaLabel}
      role="img"
      className={className}
      style={{ overflow: "visible", flexShrink: 0 }}
    />
  );
}
