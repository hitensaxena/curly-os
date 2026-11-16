"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Four surfaces. Everything the app can show lives inside one of them; there is
// no second navigation model to drift out of sync.
const ITEMS = [
  { href: "/", label: "Ask", hint: "Search your memory" },
  { href: "/library", label: "Library", hint: "Browse everything you hold" },
  { href: "/think", label: "Think", hint: "What needs your attention" },
  { href: "/system", label: "System", hint: "Health, engines, settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Rail() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: a fixed rail, always in the same place. */}
      <nav
        aria-label="Primary"
        className="fixed inset-y-0 left-0 z-30 hidden w-52 flex-col border-r border-border bg-background/80 px-3 py-6 backdrop-blur md:flex"
      >
        <Link href="/" className="mb-8 px-2 text-sm font-semibold tracking-tight text-foreground">
          CurlyOS
        </Link>

        <ul className="space-y-1">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-surface text-foreground"
                      : "text-muted hover:bg-surface/60 hover:text-foreground"
                  }`}
                  title={item.hint}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto space-y-1 border-t border-border pt-4">
          <Link
            href="/chat"
            className="block rounded px-3 py-2 text-sm text-muted transition-colors hover:bg-surface/60 hover:text-foreground"
          >
            Chat
          </Link>
          <p className="px-3 pt-2 text-[10px] leading-relaxed text-muted/70">
            ⌘K to search anywhere
          </p>
        </div>
      </nav>

      {/* Small screens: a bottom bar, same four items. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur md:hidden"
      >
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 py-3 text-center text-xs ${
                active ? "text-foreground" : "text-muted"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
