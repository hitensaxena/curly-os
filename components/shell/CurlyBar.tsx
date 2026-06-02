"use client";

import { useVoice } from "@/lib/voice/VoiceContext";
import { Spaces } from "./Spaces";

// The Omnibar spine — Curly's persistent presence and the center of the OS.
// Full-width bottom bar: the orb (rendered by CurlyOrb, floating over the left
// slot) + a command omnibox (opens the palette) + the Spaces nav menu. The live
// caption floats just above it. Mounted once in the root layout.
export function CurlyBar() {
  const v = useVoice();
  const live = v.state !== "idle" && v.state !== "error";
  const openPalette = () => window.dispatchEvent(new Event("curly-palette-open"));

  return (
    <>
      {v.caption && live && (
        <div
          className="pointer-events-none fixed inset-x-0 z-40 mx-auto max-w-[640px] px-6 text-center text-sm text-subtle"
          style={{ bottom: "calc(var(--spine-h) + 0.75rem)" }}
        >
          {v.caption}
        </div>
      )}

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/80 backdrop-blur-xl"
        style={{ height: "var(--spine-h)" }}
      >
        <div className="flex h-full items-center gap-2 px-3 sm:gap-3 sm:px-4">
          {/* Reserved slot — CurlyOrb floats over this (fixed, z-41). */}
          <div aria-hidden className="h-12 w-12 shrink-0" />

          <button
            type="button"
            onClick={openPalette}
            aria-label="Open command bar"
            className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 text-left text-sm text-muted transition-colors hover:border-border-soft hover:text-subtle"
          >
            <span className="truncate">Ask Curly, search, capture, go…</span>
            <kbd className="ml-auto hidden shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted sm:inline">
              ⌘K
            </kbd>
          </button>

          <Spaces />
        </div>
      </div>
    </>
  );
}
