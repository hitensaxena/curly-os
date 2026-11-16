"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

// One search field, present on every screen except Ask (which is already a
// search field). Submitting sends you to Library with the query applied, so
// typing anywhere gets you to the same place.
export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/library?q=${encodeURIComponent(term)}`);
    setQ("");
  };

  if (pathname === "/") return null;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-5 py-3 backdrop-blur sm:px-8">
      <form onSubmit={submit} className="mx-auto flex w-full max-w-5xl items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search memory…"
          aria-label="Search memory"
          className="w-full rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="rounded border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          Search
        </button>
      </form>
    </header>
  );
}
