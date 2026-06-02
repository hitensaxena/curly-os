"use client";

// The home command bar — a visual entry point that opens the global
// CommandPalette (which also listens for ⌘K).
export function PaletteTrigger() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("curly-palette-open"))}
      className="mx-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-border-soft bg-surface px-5 py-3.5 text-left text-muted transition hover:border-accent hover:glow"
    >
      <span className="font-mono text-accent">⌘K</span>
      <span>Ask Curly · search · do anything…</span>
    </button>
  );
}
