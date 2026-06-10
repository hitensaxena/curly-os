"use client";

import { useEffect, useState } from "react";

const API = "";

interface Memory {
  id: string;
  statement: string;
  kind: string;
  tier?: string;
  epistemic_status: string;
  valid_from: string;
  valid_to: string | null;
  source_episode_id: string;
  superseded_by: string | null;
}

// The epistemic spectrum, weakest → strongest. A memory's status is one point
// on this ladder; the detail panel shows where the selected memory sits.
const SPECTRUM = ["seed", "conjecture", "possible_world", "hypothesis", "belief", "canonical"];

const STATUS_TEXT: Record<string, string> = {
  canonical: "text-green-400",
  belief: "text-blue-400",
  hypothesis: "text-yellow-400",
  possible_world: "text-purple-400",
  conjecture: "text-orange-400",
  seed: "text-orange-300",
};
const STATUS_DOT: Record<string, string> = {
  canonical: "bg-green-400",
  belief: "bg-blue-400",
  hypothesis: "bg-yellow-400",
  possible_world: "bg-purple-400",
  conjecture: "bg-orange-400",
  seed: "bg-orange-300",
};
const statusColor = (s: string) => STATUS_TEXT[s] ?? "text-muted";

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState(""); // epistemic_status filter ("" = all)
  const [validity, setValidity] = useState<"current" | "superseded">("current");
  const [selected, setSelected] = useState<Memory | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const limit = 25;

  const load = (p: number, q: string, st: string, val: string) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(p * limit) });
    if (q) params.set("q", q);
    if (st) params.set("epistemic_status", st);
    if (val === "superseded") params.set("valid", "false");
    fetch(`${API}/api/memories?${params}`).then((r) => r.json()).then((d) => {
      setMemories(d.items || []);
      setTotal(d.count || 0);
      setLoading(false);
    });
  };

  useEffect(() => { load(page, filter, status, validity); }, [page, filter, status, validity]);

  const select = (m: Memory) => {
    setSelected(m);
    setDetail(null);
    fetch(`${API}/api/memories/${m.id}`).then((r) => r.json()).then(setDetail);
  };

  const invalidate = async (id: string) => {
    await fetch(`${API}/api/memories/${id}/invalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "invalidated via web UI" }),
    });
    load(page, filter, status, validity);
    setSelected(null);
    setDetail(null);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Memory</h1>
      <p className="text-sm text-muted mb-6">{total} facts {validity === "superseded" ? "(superseded)" : "across all tiers"}</p>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(0); }}
          placeholder="Search memories..."
          className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
        >
          <option value="">All statuses</option>
          {SPECTRUM.slice().reverse().map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={validity}
          onChange={(e) => { setValidity(e.target.value as "current" | "superseded"); setPage(0); }}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
        >
          <option value="current">Current</option>
          <option value="superseded">Superseded</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="text-muted text-sm">Loading...</div>
          ) : memories.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted text-center">
              No memories match.
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface divide-y divide-border">
              {memories.map((m) => (
                <button
                  key={m.id}
                  onClick={() => select(m)}
                  className={`w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors ${selected?.id === m.id ? "bg-surface-2 border-l-2 border-accent" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm text-foreground flex-1">{m.statement.slice(0, 150)}</span>
                    <span className={`text-[10px] font-mono shrink-0 ${statusColor(m.epistemic_status)}`}>
                      {m.epistemic_status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {m.tier && <span className="text-[10px] text-muted font-mono">{m.tier}</span>}
                    <span className="text-[10px] text-muted font-mono">{m.id.slice(0, 12)}</span>
                    {m.valid_to && <span className="text-[10px] text-red-400">SUPERSEDED</span>}
                    <span className="text-[10px] text-muted ml-auto">{new Date(m.valid_from).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted">
              <span>{page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                  className="px-3 py-1 rounded border border-border hover:border-accent disabled:opacity-30">← Prev</button>
                <button onClick={() => setPage(page + 1)} disabled={(page + 1) * limit >= total}
                  className="px-3 py-1 rounded border border-border hover:border-accent disabled:opacity-30">Next →</button>
              </div>
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-1">
          {selected ? (
            <div className="rounded-lg border border-border bg-surface p-4 sticky top-4">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-mono ${statusColor(selected.epistemic_status)}`}>
                  {selected.epistemic_status}
                </span>
                <button onClick={() => { setSelected(null); setDetail(null); }}
                  className="text-xs text-muted hover:text-foreground">✕</button>
              </div>
              <p className="text-sm text-foreground mb-3">{selected.statement}</p>

              {/* Epistemic spectrum */}
              <EpistemicSpectrum status={selected.epistemic_status} />

              {/* Bi-temporal validity */}
              <div className="mt-4 text-xs">
                <div className="text-muted/60 mb-1">Valid</div>
                <div className="flex items-center gap-2 text-foreground/90">
                  <span>{new Date(selected.valid_from).toLocaleDateString()}</span>
                  <span className="text-muted">→</span>
                  <span className={selected.valid_to ? "text-red-400" : "text-green-400"}>
                    {selected.valid_to ? new Date(selected.valid_to).toLocaleDateString() : "now"}
                  </span>
                </div>
              </div>

              {/* Version history (supersession chain) */}
              {detail && (detail.supersedes || detail.superseded_by) && (
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="text-muted/60 text-xs mb-2">Version history</div>
                  <div className="space-y-1.5">
                    {detail.supersedes && (
                      <VersionRow label="replaced" tone="past" text={detail.supersedes.statement} />
                    )}
                    <VersionRow label="this" tone="current" text={selected.statement} />
                    {detail.superseded_by && (
                      <VersionRow label="superseded by" tone="future" text={detail.superseded_by.statement} />
                    )}
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="mt-4 pt-3 border-t border-border space-y-1.5 text-xs text-muted">
                <div><span className="text-muted/60">ID:</span> <span className="font-mono">{selected.id}</span></div>
                <div><span className="text-muted/60">Kind:</span> {selected.kind}{selected.tier ? ` · ${selected.tier}` : ""}</div>
                {detail?.source_episode && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="text-muted/60 mb-1">Source episode</div>
                    <div className="font-mono text-[10px]">{detail.source_episode.id?.slice(0, 20)}</div>
                    <div className="mt-1 text-foreground/80">{detail.source_episode.content?.slice(0, 200)}</div>
                  </div>
                )}
                {!detail && <div className="text-muted/50">Loading details…</div>}
              </div>

              {!selected.valid_to && (
                <button onClick={() => invalidate(selected.id)}
                  className="mt-4 w-full rounded border border-red-800/50 bg-red-900/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/40">
                  Invalidate
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted text-center">
              Select a memory to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EpistemicSpectrum({ status }: { status: string }) {
  const activeIdx = SPECTRUM.indexOf(status);
  return (
    <div>
      <div className="flex gap-1">
        {SPECTRUM.map((s, i) => {
          const active = i === activeIdx;
          const reached = activeIdx >= 0 && i <= activeIdx;
          return (
            <div key={s} className="flex-1" title={s}>
              <div
                className={`h-1.5 rounded-full ${reached ? STATUS_DOT[status] ?? "bg-accent" : "bg-surface-2"} ${active ? "" : reached ? "opacity-50" : ""}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-muted/60">
        <span>seed</span>
        <span className={activeIdx >= 0 ? statusColor(status) : ""}>{status}</span>
        <span>canonical</span>
      </div>
    </div>
  );
}

function VersionRow({ label, tone, text }: { label: string; tone: "past" | "current" | "future"; text: string }) {
  const cls =
    tone === "current"
      ? "border-accent/40 bg-surface-2 text-foreground"
      : "border-border bg-surface text-foreground/60";
  return (
    <div className={`rounded border px-2 py-1.5 ${cls}`}>
      <div className="text-[9px] uppercase tracking-wide text-muted/60">{label}</div>
      <div className="text-[11px] leading-snug">{text?.slice(0, 120)}</div>
    </div>
  );
}
