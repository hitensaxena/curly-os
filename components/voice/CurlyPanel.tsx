"use client";

import Link from "next/link";
import { useVoice } from "@/lib/voice/VoiceContext";
import { Markdown } from "@/components/Markdown";
import { GraphPanel } from "@/components/stage/GraphPanel";
import { noteHref } from "@/lib/vault-paths";

// Curly's integrated surface: a right-side slide-over (bottom sheet on mobile)
// that is part of the OS chrome. Holds the ONE transient thing Curly surfaced
// (recall / web / think / a note / a graph). Navigation no longer lands here —
// it drives real routes. Reads everything from VoiceContext.
function eyebrow(source: string): string {
  switch (source) {
    case "tool:remember":
      return "Saved to your mind";
    case "tool:think_hard":
      return "Thought it through";
    case "tool:web_search":
    case "tool:web_fetch":
      return "From the web";
    case "tool:do_task":
      return "Done";
    case "tool:show":
      return "Curly";
    default:
      return "From your mind";
  }
}

export function CurlyPanel() {
  const v = useVoice();
  const panel = v.panel;
  if (!panel) return null;

  const open = v.panelOpen;
  const src = panel.sourcePath?.replace(/\/+$/, "") || null;

  return (
    <aside
      aria-hidden={!open}
      className={[
        "fixed z-30 flex flex-col border-border bg-surface/95 backdrop-blur-md transition-transform duration-300 ease-out",
        // mobile: bottom sheet
        "inset-x-0 bottom-0 max-h-[75vh] rounded-t-2xl border-t",
        // desktop: right rail
        "lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-0 lg:h-screen lg:max-h-none lg:w-[420px] lg:rounded-none lg:border-l lg:border-t-0",
        open ? "translate-y-0 lg:translate-x-0" : "translate-y-full lg:translate-y-0 lg:translate-x-full",
      ].join(" ")}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="text-[11px] uppercase tracking-[0.15em] text-accent-2">
          {panel.kind === "graph" ? "Your mind" : eyebrow(panel.source)}
        </span>
        <button
          type="button"
          onClick={v.closePanel}
          aria-label="Close panel"
          className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {panel.kind === "graph" ? (
          <GraphPanel nodeId={panel.nodeId ?? null} title={panel.title} />
        ) : (
          <>
            {panel.title && (
              <h2 className="mb-2 text-sm font-semibold text-foreground">{panel.title}</h2>
            )}
            {panel.body ? (
              <Markdown>{panel.body}</Markdown>
            ) : (
              <p className="text-sm text-muted">Nothing to show.</p>
            )}
          </>
        )}
      </div>

      {src && (
        <footer className="border-t border-border px-4 py-2.5">
          <Link
            href={noteHref(src)}
            onClick={v.closePanel}
            className="text-xs text-accent-2 hover:underline"
          >
            Open in notes → {src}
          </Link>
        </footer>
      )}
    </aside>
  );
}
