"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeading } from "@/components/ui/PageHeading";
import { getInboxUnreadCount } from "@/lib/curlyos";
import { SPACES, type Space } from "./nav";

// A space LANDING page: the space's blurb + a card grid of its sub-surfaces.
// This is the "organized" layer — instead of a flat menu, each task-area has a
// home you can scan. Cards link straight to the existing rich pages.
export function SpaceHub({ spaceKey }: { spaceKey: string }) {
  const space = SPACES.find((s) => s.key === spaceKey) as Space | undefined;
  const [unread, setUnread] = useState(0);

  // The Work hub surfaces inbox unread on its Inbox card.
  useEffect(() => {
    if (spaceKey !== "work") return;
    let alive = true;
    getInboxUnreadCount()
      .then((d) => { if (alive) setUnread(d.unread); })
      .catch(() => {});
    return () => { alive = false; };
  }, [spaceKey]);

  if (!space) return null;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageHeading
        title={space.label}
        eyebrow="Curly OS"
        subtitle={space.blurb}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {space.items.map((item) => {
          const badge = item.href === "/inbox" ? unread : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-soft hover:bg-surface-2/50"
            >
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted transition-colors group-hover:text-accent">
                <item.Icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  {badge > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>
                {item.blurb && <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.blurb}</p>}
              </div>
              <span className="mt-0.5 shrink-0 text-muted/40 transition-colors group-hover:text-accent">›</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
