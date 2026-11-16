"use client";

// Ask: the home screen. One input, ranked answers, and a short line about who
// the system thinks you are right now. Discovery is the first thing on screen,
// not a stats dashboard you have to read past.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const API = "";

type Hit = {
  id: string;
  text: string;
  score: number;
  tier?: string;
  epistemic_status?: string;
};

type Narrative = {
  chapter?: { title?: string; summary?: string } | null;
  themes?: { name: string }[];
  counts?: { chapters: number; themes: number };
};

const SUGGESTIONS = [
  "what am I working on",
  "what did I decide about the archive",
  "my music setup",
  "what do I believe about memory",
];

function statusTone(status?: string): string {
  if (status === "canonical") return "text-accent";
  if (status === "belief") return "text-yellow-400";
  if (status === "hypothesis" || status === "conjecture") return "text-muted";
  return "text-muted";
}

export default function AskPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch(`${API}/api/cognition/narrative/current`, { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setNarrative(d as Narrative | null))
      .catch(() => setNarrative(null));
  }, []);

  async function ask(term: string) {
    const query = term.trim();
    if (!query || busy) return;
    setBusy(true);
    setError(null);
    setAsked(true);
    try {
      const r = await fetch(`${API}/api/recall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, k: 12, mode: "deep" }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!r.ok) throw new Error(`recall → ${r.status}`);
      const d = await r.json();
      setHits(Array.isArray(d.items) ? d.items : Array.isArray(d.results) ? d.results : []);
    } catch (e) {
      setHits([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ask your memory</h1>
      <p className="mt-1 text-sm text-muted">
        {narrative?.counts
          ? `${narrative.counts.chapters} chapters · ${narrative.counts.themes} themes · every fact you have stored`
          : "Everything you have stored, ranked by what matches."}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="mt-6 flex items-center gap-2"
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What do you want to know?"
          aria-label="Ask your memory"
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-background transition-opacity disabled:opacity-40"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>

      {!asked && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setQ(s);
                ask(s);
              }}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-6 rounded border border-red-400/30 bg-red-400/5 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {asked && !busy && hits.length === 0 && !error && (
        <p className="mt-8 text-sm text-muted">
          Nothing matched. Try different words, or{" "}
          <Link href="/library" className="text-accent hover:underline">
            browse the library
          </Link>
          .
        </p>
      )}

      {hits.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-xs uppercase tracking-wide text-muted">Answers</h2>
            <Link
              href={`/library?q=${encodeURIComponent(q)}`}
              className="text-xs text-muted hover:text-foreground"
            >
              see all matches →
            </Link>
          </div>
          <ol className="space-y-2">
            {hits.map((hit, i) => (
              <li key={hit.id ?? i}>
                <Link
                  href={`/library/${encodeURIComponent(hit.id)}`}
                  className="block rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent/60"
                >
                  <p className="text-sm leading-relaxed text-foreground">{hit.text}</p>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted">
                    <span className={statusTone(hit.epistemic_status)}>
                      {hit.epistemic_status ?? "—"}
                    </span>
                    {hit.tier && <span>{hit.tier}</span>}
                    <span>score {Number(hit.score ?? 0).toFixed(2)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {narrative?.chapter?.title && (
        <section className="mt-10 rounded-lg border border-border bg-surface/60 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-muted">Current chapter</p>
          <p className="mt-1 text-sm font-medium text-foreground">{narrative.chapter.title}</p>
          {narrative.chapter.summary && (
            <p className="mt-1 text-xs leading-relaxed text-muted">{narrative.chapter.summary}</p>
          )}
          {narrative.themes && narrative.themes.length > 0 && (
            <p className="mt-2 text-[11px] text-muted">
              Themes: {narrative.themes.slice(0, 6).map((t) => t.name).join(" · ")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
