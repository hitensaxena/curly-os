"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { getInboxUnreadCount } from "@/lib/curlyos";
import { NAV_GROUPS, NAV_HOME, SearchIcon, type NavItem } from "./nav";

// Floating navigation — a top-left menu button that opens the workspace list
// (the old rail/bar nav, now a popover) plus a "search / ask Curly" entry that
// opens the command palette. The bar is gone; this + the floating orb are the
// shell's only chrome, so content stays full-bleed.
export function FloatingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Inbox unread badge — refresh on mount, when the menu opens, on navigation,
  // and whenever the inbox page signals a change.
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      getInboxUnreadCount()
        .then((d) => { if (alive) setUnread(d.unread); })
        .catch(() => {});
    refresh();
    window.addEventListener("curly-inbox-changed", refresh);
    return () => {
      alive = false;
      window.removeEventListener("curly-inbox-changed", refresh);
    };
  }, [pathname, open]);

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

  // close the menu on navigation
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div ref={ref} className="fixed left-4 top-4 z-40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-border bg-surface/70 px-2.5 py-2 shadow-lg backdrop-blur-xl transition-colors hover:border-border-soft"
      >
        <Logo size="sm" />
        <span className="hidden text-sm font-semibold text-foreground sm:inline">Curly OS</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 max-h-[80vh] w-56 overflow-y-auto rounded-xl border border-border-soft bg-surface/95 p-1.5 backdrop-blur-xl glow"
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new Event("curly-palette-open"));
            }}
            className="mb-1 flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <SearchIcon className="h-4 w-4 shrink-0" />
            <span>Search · ask Curly</span>
            <kbd className="ml-auto rounded bg-surface px-1.5 py-0.5 text-[10px]">⌘K</kbd>
          </button>
          <div className="my-1 h-px bg-border" />
          <NavLink item={NAV_HOME} pathname={pathname} onNavigate={() => setOpen(false)} />
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mt-1">
              <div className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/60">
                {group.label}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  badge={item.href === "/inbox" ? unread : 0}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NavLink({
  item,
  pathname,
  badge = 0,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  badge?: number;
  onNavigate: () => void;
}) {
  const { href, label, Icon } = item;
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
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
      {badge > 0 && (
        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
