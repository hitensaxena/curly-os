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

function XIcon() {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function CurlyPanel() {
  const v = useVoice();
  const panel = v.panel;
  if (!panel) return null;

  const open = v.panelOpen;
  const src = panel.sourcePath?.replace(/\/+$/, "") || null;

  // Determine if panel body is missing (error/empty state)
  const hasBody = panel.kind === "graph" || Boolean(panel.body);

  return (
    <>
      {/* Mobile-only scrim — sits below panel (z-44) so tapping it closes the sheet */}
      {open && (
        <div
          aria-hidden
          className="fixed inset-0 z-[44] bg-black/40 lg:hidden"
          onClick={v.closePanel}
        />
      )}

      <aside
        aria-hidden={!open}
        className={[
          // z-index: raise to z-45 when open so panel floats above scrim (z-44) and orb (z-40 normally)
          "fixed flex flex-col transition-transform duration-300",
          open ? "z-[45]" : "z-30",
          // Glass surface with teal edge shadow
          "border-border bg-surface/80 backdrop-blur-xl",
          "shadow-[0_0_0_1px_rgba(45,226,230,0.10),0_0_32px_-4px_rgba(45,226,230,0.12)]",
          // Top hairline
          "border-t border-white/5",
          // Mobile: bottom sheet
          "inset-x-0 bottom-0 max-h-[75vh] rounded-t-2xl",
          // Desktop: right rail — override mobile overrides
          "lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-0 lg:h-screen lg:max-h-none lg:w-[420px] lg:rounded-none lg:border-l lg:border-t-0",
          // Slide transitions
          open ? "translate-y-0 lg:translate-x-0" : "translate-y-full lg:translate-y-0 lg:translate-x-full",
        ].join(" ")}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="text-[11px] uppercase tracking-[0.15em] text-accent-2">
            {panel.kind === "graph" ? "Your mind" : eyebrow(panel.source)}
          </span>
          <button
            type="button"
            onClick={v.closePanel}
            aria-label="Close panel"
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          >
            <XIcon />
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
              {hasBody ? (
                <Markdown>{panel.body!}</Markdown>
              ) : (
                /* Error / empty state — rose-tinted notice */
                <div
                  className="flex items-start gap-2 rounded-lg border px-3 py-2.5"
                  style={{
                    borderColor: "rgba(var(--danger-rgb, 251,113,133), 0.30)",
                    background: "rgba(var(--danger-rgb, 251,113,133), 0.07)",
                  }}
                >
                  <svg
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: "var(--danger, #FF8FB1)" }}
                    aria-hidden
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <p
                    className="text-sm"
                    style={{ color: "var(--danger, #FF8FB1)" }}
                  >
                    Nothing to show — Curly didn&apos;t surface any content.
                  </p>
                </div>
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
    </>
  );
}
