"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// The OS launcher. ⌘K (or the home command bar's custom event) summons it.
// M1: navigation + "Ask Curly" entry to chat. M2 wires brain /search results
// (Notes) and entities (Connections) into the same surface.
type Item = { id: string; label: string; hint?: string; run: () => void };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("curly-palette-open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("curly-palette-open", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const items: Item[] = [
    { id: "home", label: "Home", hint: "dashboard", run: () => go("/") },
    { id: "chat", label: "New chat with Curly", hint: "↵", run: () => go("/chat") },
  ];

  const query = q.trim();
  const filtered = query
    ? items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : items;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[18vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border-soft bg-surface glow"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query) go("/chat");
          }}
          placeholder="Ask Curly · search · jump anywhere…"
          className="w-full bg-transparent px-5 py-4 text-base text-foreground placeholder:text-muted outline-none"
        />
        <div className="max-h-80 overflow-y-auto border-t border-border py-2">
          {query && (
            <button
              onClick={() => go("/chat")}
              className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-surface-2"
            >
              <span className="text-accent">✦</span>
              <span className="text-foreground">Ask Curly</span>
              <span className="truncate text-muted">“{query}”</span>
            </button>
          )}
          {filtered.map((i) => (
            <button
              key={i.id}
              onClick={i.run}
              className="flex w-full items-center justify-between px-5 py-2.5 text-left hover:bg-surface-2"
            >
              <span className="text-foreground">{i.label}</span>
              {i.hint && <span className="text-xs text-muted">{i.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
