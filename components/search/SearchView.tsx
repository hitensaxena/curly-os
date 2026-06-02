"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDebouncedSearch } from "@/lib/use-debounced-search";
import { noteHref } from "@/lib/vault-paths";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { SearchResponse, SearchNote } from "@/app/api/search/route";

const SOURCE_LABEL: Record<SearchNote["source"], string> = {
  content: "in text",
  brain: "brain",
  name: "filename",
};

async function fetcher(q: string, signal: AbortSignal): Promise<SearchResponse> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) throw new Error("search failed");
  return res.json();
}

export function SearchView() {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const { result, searching } = useDebouncedSearch<SearchResponse>(q, fetcher);

  const hasQuery = q.trim().length >= 2;
  const notes = result?.notes ?? [];
  const chats = result?.chats ?? [];
  const nothing = hasQuery && !searching && result && notes.length === 0 && chats.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <Input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your mind — notes, journals, conversations…"
        className="text-base"
      />

      {!hasQuery && (
        <p className="mt-4 px-1 text-sm text-muted">
          Type at least two characters. Matches note text, filenames, the brain, and past chats.
        </p>
      )}

      {hasQuery && (
        <div className="mt-2 px-1 text-xs text-muted">
          {searching ? "Searching…" : result ? `${notes.length} notes · ${chats.length} chats` : ""}
        </div>
      )}

      {nothing && (
        <EmptyState
          className="mt-10"
          title="No matches"
          body={`Nothing in your mind matches “${q.trim()}”.`}
        />
      )}

      {notes.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">Notes</h2>
          <div className="space-y-2">
            {notes.map((n) => (
              <Card key={n.rel} as={Link} href={noteHref(n.rel)} interactive>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium text-foreground">{n.title}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">
                    {SOURCE_LABEL[n.source]}
                  </span>
                </div>
                {n.snippet && (
                  <p className="mt-1 line-clamp-2 text-xs text-subtle">{n.snippet}</p>
                )}
                <div className="mt-1 truncate text-[11px] text-muted">{n.rel}</div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {chats.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">Conversations</h2>
          <div className="space-y-2">
            {chats.map((c) => (
              <Card key={c.id} as={Link} href={`/chat/${c.id}`} interactive>
                <div className="truncate text-sm font-medium text-foreground">{c.first_q}</div>
                <p className="mt-1 line-clamp-2 text-xs text-subtle">{c.snippet}</p>
                <div className="mt-1 text-[11px] text-muted">
                  {c.message_count} msg · matched in {c.matched_in}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
