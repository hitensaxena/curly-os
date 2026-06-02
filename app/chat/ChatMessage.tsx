"use client";

import Link from "next/link";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isSettingsReadable } from "@/lib/vault-paths";
import { AnimatedLogo } from "@/components/AnimatedLogo";

export type RetrievalChunk = {
  path: string;
  title: string;
  distance: number | null;
};

export type Activity = { tool: string; label: string };

export type Phase = "retrieving" | "thinking" | "working" | "writing" | "done";

type Props = {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: string;
  retrieval?: RetrievalChunk[];
  thinking?: string;
  activities?: Activity[];
  phase?: Phase;
};

// Phase → loader copy + bloom-mark animation state. Drives the "what is
// Claude doing right now" indicator while a turn streams in.
function phaseDisplay(
  phase: Phase | undefined,
  activities: Activity[] | undefined,
): { label: string; state: "loading" | "thinking" | "drafting" } {
  switch (phase) {
    case "thinking":
      return { label: "Thinking…", state: "thinking" };
    case "working":
      return {
        label: activities?.[activities.length - 1]?.label ?? "Working…",
        state: "loading",
      };
    case "writing":
      return { label: "Writing…", state: "drafting" };
    case "retrieving":
    default:
      return { label: "Searching the vault…", state: "loading" };
  }
}

// Heuristic: when Claude writes `personal_lore.md` (an inline code span ending
// in .md), we treat it as a citation and link to the settings editor for that
// file. The Settings phase will register routes under /settings/<...>.
function FilenameCode({ name }: { name: string }) {
  return (
    <Link
      href={`/settings/${name}`}
      className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground underline decoration-dotted underline-offset-2 hover:bg-surface-3"
    >
      {name}
    </Link>
  );
}

export function ChatMessage({
  role,
  content,
  streaming,
  error,
  retrieval,
  thinking,
  activities,
  phase,
}: Props) {
  const isUser = role === "user";
  const waiting = !!streaming && !content;
  return (
    <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      {!isUser && retrieval && retrieval.length > 0 && (
        <RetrievalSummary chunks={retrieval} />
      )}
      {!isUser && thinking && (
        <ThinkingPanel text={thinking} active={!!streaming && !content} />
      )}
      {!isUser && activities && activities.length > 0 && (
        <ActivityTimeline activities={activities} active={!!streaming && !content} />
      )}
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "bg-accent text-accent-fg"
            : "bg-surface text-foreground"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{content}</div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-surface-2 prose-pre:text-foreground">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code(props) {
                  const { className, children, ...rest } = props;
                  const text = String(children ?? "");
                  // Block code (has language-* class) → leave as <code> for prose styling.
                  if (className) return <code className={className} {...rest}>{children}</code>;
                  // Inline citation: a bare filename ending in .md, only
                  // rendered as a link when the path is something /settings
                  // can actually open.
                  if (
                    /^[\w./-]+\.md$/.test(text) &&
                    !text.startsWith("/") &&
                    isSettingsReadable(text)
                  ) {
                    return <FilenameCode name={text} />;
                  }
                  return <code {...rest}>{children}</code>;
                },
              }}
            >
              {content}
            </ReactMarkdown>
            {waiting && (() => {
              const { label, state } = phaseDisplay(phase, activities);
              return (
                <div className="flex items-center gap-2 py-1 text-xs text-muted">
                  <AnimatedLogo state={state} size="sm" />
                  <span>{label}</span>
                </div>
              );
            })()}
            {error && (
              <p className="mt-2 text-xs text-danger">⚠ {error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Collapsible reasoning panel. Auto-opens while Claude is actively thinking
// (streaming, no answer text yet) and auto-collapses once the answer starts;
// the user can still toggle it afterwards. Uses the codebase's "store info
// from prior render" pattern instead of an effect.
function ThinkingPanel({ text, active }: { text: string; active: boolean }) {
  const [open, setOpen] = useState(active);
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    setOpen(active);
  }
  return (
    <div className="max-w-[90%] text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11px] text-muted hover:text-foreground"
      >
        {active ? (
          <AnimatedLogo state="thinking" size="xs" />
        ) : (
          <span aria-hidden>✦</span>
        )}
        <span>{active ? "Thinking…" : "Thought process"}</span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-1 whitespace-pre-wrap rounded border-l-2 border-border bg-surface-2 px-3 py-2 italic leading-relaxed text-subtle">
          {text}
        </div>
      )}
    </div>
  );
}

// Compact timeline of the tools Claude reached for this turn — the detailed
// "loading state" of a working turn. The last row pulses while still active.
function ActivityTimeline({
  activities,
  active,
}: {
  activities: Activity[];
  active: boolean;
}) {
  return (
    <ul className="max-w-[90%] space-y-0.5 text-[11px] text-muted">
      {activities.map((a, i) => {
        const isLast = i === activities.length - 1;
        return (
          <li key={i} className="flex items-center gap-2">
            <span
              aria-hidden
              className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                active && isLast ? "animate-pulse bg-accent" : "bg-border"
              }`}
            />
            <span className="truncate">{a.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

function RetrievalSummary({ chunks }: { chunks: RetrievalChunk[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="max-w-[90%] text-xs text-muted">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="font-mono text-[11px] hover:underline"
      >
        Retrieved {chunks.length} chunk{chunks.length === 1 ? "" : "s"} {open ? "▾" : "▸"}
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 rounded border border-border bg-surface-2 px-2 py-1.5 font-mono text-[11px]">
          {chunks.map((c, i) => (
            <li key={i} className="flex items-baseline gap-2">
              <span className="shrink-0 opacity-60">
                {c.distance !== null ? c.distance.toFixed(3) : "—"}
              </span>
              <span className="truncate">
                <span className="text-subtle">{c.path}</span>
                <span className="opacity-60"> · {c.title}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
