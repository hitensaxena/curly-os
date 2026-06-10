"use client";

import { useEffect, useState } from "react";

const API = "";

interface Episode {
  id: string;
  content: string;
  source_ref: string | null;
  modality: string | null;
  ingested_at: string;
  created_at?: string;
}

interface LinkedMemory {
  id: string;
  statement: string;
  epistemic_status: string;
  valid_from: string;
  valid_to: string | null;
}

const EPISTEMIC_COLOR: Record<string, string> = {
  canonical: "text-green-400",
  belief: "text-blue-400",
  hypothesis: "text-yellow-400",
  seed: "text-orange-400",
};

function epistemicColor(s: string) {
  return EPISTEMIC_COLOR[s] ?? "text-muted";
}

export default function EpisodesPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Episode | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalityFilter, setModalityFilter] = useState("");
  const limit = 20;

  // Derive distinct modalities from the currently-loaded page of episodes.
  const distinctModalities = Array.from(
    new Set(episodes.map((e) => e.modality).filter(Boolean) as string[])
  ).sort();

  const load = (p: number, modality: string) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(p * limit) });
    if (modality) params.set("modality", modality);
    fetch(`${API}/api/episodes?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setEpisodes(d.items || []);
        setTotal(d.count || 0);
        setLoading(false);
      });
  };

  useEffect(() => {
    load(page, modalityFilter);
  }, [page, modalityFilter]);

  const select = (e: Episode) => {
    setSelected(e);
    fetch(`${API}/api/episodes/${e.id}`)
      .then((r) => r.json())
      .then(setDetail);
  };

  const handleModalityChange = (m: string) => {
    setModalityFilter(m);
    setPage(0);
    setSelected(null);
    setDetail(null);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Episodes</h1>
      <p className="text-sm text-muted mb-4">{total} provenance anchors</p>

      {/* Modality filter */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-xs text-muted shrink-0">Modality</label>
        <select
          value={modalityFilter}
          onChange={(e) => handleModalityChange(e.target.value)}
          className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent"
        >
          <option value="">All</option>
          {distinctModalities.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {modalityFilter && (
          <button
            onClick={() => handleModalityChange("")}
            className="text-[10px] text-muted hover:text-foreground"
          >
            ✕ clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="text-muted text-sm">Loading...</div>
          ) : (
            <div className="rounded-lg border border-border bg-surface divide-y divide-border">
              {episodes.map((e) => (
                <button
                  key={e.id}
                  onClick={() => select(e)}
                  className={`w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors ${
                    selected?.id === e.id ? "bg-surface-2 border-l-2 border-accent" : ""
                  }`}
                >
                  <p className="text-sm text-foreground line-clamp-2">{e.content?.slice(0, 200)}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-muted font-mono">{e.id.slice(0, 16)}</span>
                    {e.modality && (
                      <span className="text-[10px] text-muted bg-surface-2 border border-border rounded px-1.5 py-0.5 font-mono">
                        {e.modality}
                      </span>
                    )}
                    {e.source_ref && (
                      <span className="text-[10px] text-accent">{e.source_ref}</span>
                    )}
                    <span className="text-[10px] text-muted">
                      {new Date(e.ingested_at).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {total > limit && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted">
              <span>
                {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded border border-border hover:border-accent disabled:opacity-30"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={(page + 1) * limit >= total}
                  className="px-3 py-1 rounded border border-border hover:border-accent disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          {selected && detail ? (
            <div className="rounded-lg border border-border bg-surface p-4 sticky top-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted font-mono">{selected.id.slice(0, 20)}</span>
                <button
                  onClick={() => {
                    setSelected(null);
                    setDetail(null);
                  }}
                  className="text-xs text-muted hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-foreground mb-4 whitespace-pre-wrap">{selected.content}</p>
              {selected.source_ref && (
                <div className="text-xs text-muted mb-3">
                  <span className="text-muted/60">Source:</span> {selected.source_ref}
                </div>
              )}
              {detail.memories?.length > 0 && (
                <div className="border-t border-border pt-3 mt-3">
                  <div className="text-xs text-muted mb-2">
                    Linked Memories ({detail.memories.length}):
                  </div>
                  {detail.memories.map((m: LinkedMemory) => (
                    <div
                      key={m.id}
                      className="text-xs text-foreground/80 mb-2 pl-2 border-l border-accent/30"
                    >
                      <p className="mb-0.5">{m.statement?.slice(0, 100)}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {m.epistemic_status && (
                          <span
                            className={`font-mono text-[10px] ${epistemicColor(m.epistemic_status)}`}
                          >
                            {m.epistemic_status}
                          </span>
                        )}
                        {m.valid_to && (
                          <span className="text-[10px] font-semibold text-red-400 tracking-wide">
                            SUPERSEDED
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted text-center">
              Select an episode to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
