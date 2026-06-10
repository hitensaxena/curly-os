"use client";

import Link from "next/link";
import { useState } from "react";

// A retrieval source Curly pulled in to answer a turn. `kind` distinguishes a
// long-term memory from a vault note (notes deep-link into the notes browser);
// `distance` is the similarity score for memory hits (null for notes).
export type RetrievalChunk = {
  kind?: "memory" | "note" | "identity";
  path: string;
  title: string;
  distance: number | null;
};

// "Grounded on" — the transparency strip showing which long-term memories and
// vault notes grounded a reply. Collapsed by default to a one-line summary;
// expands to a clickable source list. Shared by the chat view and the agent
// console so both show retrieval the same way.
export function GroundedOn({ chunks }: { chunks: RetrievalChunk[] }) {
  const [open, setOpen] = useState(false);
  const memories = chunks.filter((c) => c.kind === "memory");
  const notes = chunks.filter((c) => c.kind === "note");
  const summary =
    [
      memories.length ? `${memories.length} ${memories.length === 1 ? "memory" : "memories"}` : "",
      notes.length ? `${notes.length} ${notes.length === 1 ? "note" : "notes"}` : "",
    ]
      .filter(Boolean)
      .join(" · ") || `${chunks.length} source${chunks.length === 1 ? "" : "s"}`;

  return (
    <div className="max-w-[90%] text-xs text-muted">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11px] hover:text-foreground"
      >
        <span aria-hidden>✦</span>
        <span>Grounded on {summary}</span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 rounded border border-border bg-surface-2 px-2 py-1.5 text-[11px]">
          {chunks.map((c, i) => (
            <GroundedItem key={i} chunk={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function GroundedItem({ chunk }: { chunk: RetrievalChunk }) {
  const score = chunk.distance !== null ? chunk.distance.toFixed(2) : null;
  if (chunk.kind === "note") {
    return (
      <li className="flex items-baseline gap-2">
        <span className="shrink-0 opacity-50">note</span>
        <Link
          href={`/notes/${chunk.path}`}
          className="truncate text-subtle underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
          {chunk.path}
        </Link>
      </li>
    );
  }
  // memory / identity — no per-row deep link yet, so show the snippet inline.
  return (
    <li className="flex items-baseline gap-2">
      <span className="shrink-0 font-mono opacity-50">{score ?? chunk.kind ?? "src"}</span>
      <span className="truncate text-subtle">{chunk.title}</span>
    </li>
  );
}
