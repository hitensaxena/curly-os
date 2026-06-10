"use client";

import { useEffect, useState } from "react";

const API = "";

interface IdentityFact {
  id: string;
  predicate: string;
  object: string;
  confidence: number;
  epistemic_status: string;
  valid_from: string;
  valid_to: string | null;
  source_episode_id: string | null;
  superseded_by: string | null;
}

function statusColor(s: string): string {
  if (s === "canonical") return "text-green-400";
  if (s === "belief") return "text-blue-400";
  if (s === "hypothesis") return "text-yellow-400";
  if (s === "seed") return "text-orange-400";
  return "text-muted";
}

export default function IdentityPage() {
  const [facts, setFacts] = useState<IdentityFact[]>([]);
  const [history, setHistory] = useState<IdentityFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newPred, setNewPred] = useState("");
  const [newObj, setNewObj] = useState("");
  const [newConf, setNewConf] = useState(0.8);
  const [historyOpen, setHistoryOpen] = useState(false);
  // episodeCache: factId -> episode content (or null if fetch failed / not fetched)
  const [episodeCache, setEpisodeCache] = useState<Record<string, string | null>>({});
  // expandedEpisodes: set of factIds whose episode is currently shown
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch(`${API}/api/identity`).then((r) => r.json()).catch(() => ({ items: [] })),
      fetch(`${API}/api/identity?valid=false`).then((r) => r.json()).catch(() => ({ items: [] })),
    ]).then(([current, hist]) => {
      if (!mounted) return;
      setFacts(current.items || []);
      setHistory(hist.items || []);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const addFact = async () => {
    if (!newPred.trim() || !newObj.trim()) return;
    await fetch(`${API}/api/identity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predicate: newPred, object: newObj, confidence: newConf }),
    });
    setShowAdd(false);
    setNewPred("");
    setNewObj("");
    setNewConf(0.8);
    fetch(`${API}/api/identity`).then((r) => r.json()).then((d) => setFacts(d.items || []));
  };

  const toggleEpisode = (fact: IdentityFact) => {
    if (!fact.source_episode_id) return;
    const factId = fact.id;
    const episodeId = fact.source_episode_id;

    setExpandedEpisodes((prev) => {
      const next = new Set(prev);
      if (next.has(factId)) {
        next.delete(factId);
      } else {
        next.add(factId);
      }
      return next;
    });

    // Fetch if not yet cached (undefined = not fetched, null = failed)
    if (!(episodeId in episodeCache)) {
      fetch(`${API}/api/episodes/${episodeId}`)
        .then((r) => r.json())
        .then((d) => {
          const content: string | null = d?.episode?.content ?? null;
          setEpisodeCache((prev) => ({ ...prev, [episodeId]: content }));
        })
        .catch(() => {
          setEpisodeCache((prev) => ({ ...prev, [episodeId]: null }));
        });
    }
  };

  // Group current facts by predicate category
  const groups: Record<string, IdentityFact[]> = {};
  for (const f of facts) {
    const cat = f.predicate.split("_")[0] || "other";
    groups[cat] = groups[cat] || [];
    groups[cat].push(f);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-muted">Loading...</div>;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Identity</h1>
          <p className="text-sm text-muted">{facts.length} identity facts</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20">
          + Add Fact
        </button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border bg-surface p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={newPred} onChange={(e) => setNewPred(e.target.value)}
              placeholder="Predicate (e.g. prefers_editor)"
              className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted" />
            <input value={newObj} onChange={(e) => setNewObj(e.target.value)}
              placeholder="Object (e.g. Zed)"
              className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted" />
            <div className="flex items-center gap-2">
              <input type="range" min="0.1" max="1" step="0.05" value={newConf}
                onChange={(e) => setNewConf(parseFloat(e.target.value))}
                className="flex-1" />
              <span className="text-xs text-muted w-10">{newConf.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={addFact} className="rounded bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/80">Save</button>
            <button onClick={() => setShowAdd(false)} className="rounded border border-border px-4 py-1.5 text-sm text-muted hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">{cat}</h2>
            <div className="rounded-lg border border-border bg-surface divide-y divide-border">
              {items.map((f) => (
                <div key={f.id} className="px-4 py-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm text-foreground">
                          <span className="text-accent font-mono">{f.predicate}</span>
                          {" = "}
                          <span>{f.object}</span>
                        </div>
                        {f.epistemic_status && (
                          <span className={`text-[10px] font-mono shrink-0 ${statusColor(f.epistemic_status)}`}>
                            {f.epistemic_status}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <div className="text-[10px] text-muted font-mono">{f.id.slice(0, 20)}</div>
                        {f.source_episode_id && (
                          <button
                            onClick={() => toggleEpisode(f)}
                            className="text-[10px] text-muted hover:text-foreground font-mono underline underline-offset-2"
                          >
                            from episode {f.source_episode_id.slice(0, 8)}…
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="w-24 shrink-0">
                      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${f.confidence * 100}%` }} />
                      </div>
                      <div className="text-[10px] text-muted text-right mt-0.5">{f.confidence.toFixed(2)}</div>
                    </div>
                    {f.valid_to && <span className="text-[10px] text-red-400 shrink-0">SUPERSEDED</span>}
                  </div>
                  {f.source_episode_id && expandedEpisodes.has(f.id) && episodeCache[f.source_episode_id] && (
                    <div className="mt-2 rounded border border-border bg-surface px-3 py-2 text-[11px] text-muted leading-relaxed">
                      {episodeCache[f.source_episode_id]!.slice(0, 200)}
                      {episodeCache[f.source_episode_id]!.length > 200 && "…"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex items-center gap-2 text-xs text-muted hover:text-foreground font-semibold uppercase tracking-wide mb-3"
          >
            <span>{historyOpen ? "▾" : "▸"}</span>
            <span>History ({history.length} superseded)</span>
          </button>
          {historyOpen && (
            <div className="rounded-lg border border-border bg-surface divide-y divide-border">
              {history.map((f) => (
                <div key={f.id} className="px-4 py-3 flex items-center gap-4 opacity-60">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm text-muted font-mono">
                        {f.predicate}
                        {" = "}
                        {f.object}
                      </div>
                      {f.epistemic_status && (
                        <span className={`text-[10px] font-mono shrink-0 ${statusColor(f.epistemic_status)}`}>
                          {f.epistemic_status}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted mt-0.5">
                      {f.valid_from ? new Date(f.valid_from).toLocaleDateString() : "?"}
                      {" → "}
                      {f.valid_to ? new Date(f.valid_to).toLocaleDateString() : "present"}
                    </div>
                  </div>
                  <div className="w-24 shrink-0">
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full rounded-full bg-muted" style={{ width: `${f.confidence * 100}%` }} />
                    </div>
                    <div className="text-[10px] text-muted text-right mt-0.5">{f.confidence.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
