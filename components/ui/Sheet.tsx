"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: React.ReactNode;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Bottom sheet for mobile. Backdrop-tap or Esc closes; Tab cycles inside.
// Slide-up animation respects prefers-reduced-motion via the globals.css
// guard, which clamps animation-duration to 0.01ms.
export function Sheet({ open, onClose, ariaLabel, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    previousActive.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const sheet = sheetRef.current;
    const first = sheet?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !sheet) return;
      const nodes = sheet.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (nodes.length === 0) return;
      const head = nodes[0];
      const tail = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === head) {
        tail.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === tail) {
        head.focus();
        e.preventDefault();
      }
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      const prev = previousActive.current;
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 motion-safe:animate-[sheetFadeIn_200ms_ease-out]"
      />
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface px-4 pb-8 pt-3 shadow-2xl motion-safe:animate-[sheetSlideUp_240ms_var(--ease-out)]"
      >
        <div
          aria-hidden
          className="mx-auto mb-3 h-1 w-12 rounded-full bg-border"
        />
        {children}
      </div>
    </div>
  );
}
