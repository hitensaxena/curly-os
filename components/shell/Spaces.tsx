"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV, ChevronIcon } from "./nav";

// The OS navigation, collapsed into a "Spaces" menu in the Curly bar. Opens a
// popover above the bar with the workspace list + active highlight. Replaces the
// old left rail — Curly's bar is the shell now.
export function Spaces() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <span className="hidden sm:inline">Spaces</span>
        <ChevronIcon className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 mb-2 w-56 overflow-hidden rounded-xl border border-border-soft bg-surface/95 p-1.5 backdrop-blur-xl glow"
        >
          {NAV.map(({ href, label, Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "border-l-2 border-accent bg-accent-soft text-foreground"
                    : "text-muted hover:bg-surface-2 hover:text-foreground",
                ].join(" ")}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-accent" : ""}`} />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
