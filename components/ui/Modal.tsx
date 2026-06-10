"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  ariaLabel?: string;
  children: React.ReactNode;
  widthClass?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Centered modal dialog (portal to <body>). Backdrop-tap or Esc closes; focus
// moves into the dialog and Tab cycles within it. Slide/fade respects
// prefers-reduced-motion via the globals.css animation-duration clamp.
export function Modal({ open, onClose, title, ariaLabel, children, widthClass = "max-w-lg" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const previousActive = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    previousActive.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = ref.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
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

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={ariaLabel ?? title}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm motion-safe:animate-[sheetFadeIn_180ms_ease-out]"
      />
      <div
        ref={ref}
        className={`relative z-10 w-full ${widthClass} max-h-[88vh] overflow-y-auto rounded-t-2xl border border-border bg-surface p-5 shadow-2xl motion-safe:animate-[sheetSlideUp_220ms_var(--ease-out)] sm:rounded-2xl`}
      >
        {title && <h2 className="mb-4 text-base font-semibold text-foreground">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}
