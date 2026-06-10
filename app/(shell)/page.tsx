"use client";

import { useEffect, useState } from "react";

const API = "";

interface Stats {
  episodes: number;
  memories: number;
  identity_facts: number;
  events: number;
  knowledge_entities: number;
  knowledge_edges: number;
  principles: number;
}

interface Composition {
  memories_by_status: Record<string, number>;
  memories_by_tier: Record<string, number>;
  identity_by_status: Record<string, number>;
  memories_changed_7d: number;
}

interface EventItem {
  id: string;
  type: string;
  subject: string | null;
  data: Record<string, unknown>;
  seq: number;
  created_at: string;
}

// Epistemic spectrum order
const STATUS_ORDER = ["seed", "conjecture", "possible_world", "hypothesis", "belief", "canonical"];

const STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  canonical:     { bg: "bg-green-500",  text: "text-green-400",  label: "Canonical" },
  belief:        { bg: "bg-blue-500",   text: "text-blue-400",   label: "Belief" },
  hypothesis:    { bg: "bg-yellow-500", text: "text-yellow-400", label: "Hypothesis" },
  possible_world:{ bg: "bg-purple-500", text: "text-purple-400", label: "Possible" },
  conjecture:    { bg: "bg-orange-500", text: "text-orange-400", label: "Conjecture" },
  seed:          { bg: "bg-orange-400", text: "text-orange-300", label: "Seed" },
};

const TIER_ORDER = ["working", "episodic", "semantic", "graph"];
const TIER_COLOR: Record<string, string> = {
  working:  "bg-accent/70",
  episodic: "bg-blue-500/70",
  semantic: "bg-purple-500/70",
  graph:    "bg-green-500/70",
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [composition, setComposition] = useState<Composition | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; statement: string; score: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/stats`).then((r) => r.json()),
      fetch(`${API}/api/events?limit=10`).then((r) => r.json()),
      fetch(`${API}/api/stats/composition`).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([s, e, c]) => {
      setStats(s);
      setEvents(e.items || []);
      setComposition(c);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      fetch(`${API}/api/search?q=${encodeURIComponent(search)}&limit=8`)
        .then((r) => r.json())
        .then((d) => setResults(d.items || []));
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted">Loading...</div>;

  const statCards = [
    { label: "Episodes",  value: stats?.episodes ?? 0,          sub: "provenance anchors" },
    { label: "Memories",  value: stats?.memories ?? 0,          sub: "semantic facts" },
    { label: "Identity",  value: stats?.identity_facts ?? 0,    sub: "self-model triples" },
    { label: "Entities",  value: stats?.knowledge_entities ?? 0, sub: "knowledge graph" },
    { label: "Edges",     value: stats?.knowledge_edges ?? 0,   sub: "relationships" },
  ];

  // Build proportional bar data for memories_by_status
  const statusEntries = composition
    ? STATUS_ORDER
        .filter((s) => (composition.memories_by_status[s] ?? 0) > 0)
        .map((s) => ({ key: s, count: composition.memories_by_status[s] }))
    : [];
  const statusTotal = statusEntries.reduce((a, b) => a + b.count, 0);

  // Build tier chips
  const tierEntries = composition
    ? TIER_ORDER
        .filter((t) => (composition.memories_by_tier[t] ?? 0) > 0)
        .map((t) => ({ key: t, count: composition.memories_by_tier[t] }))
    : [];
  const tierTotal = tierEntries.reduce((a, b) => a + b.count, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">CurlyOS</h1>
      <p className="text-sm text-muted mb-8">Your cognitive architecture — memory, knowledge, identity, cognition.</p>

      {/* Search */}
      <div className="mb-8">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search memories..."
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        />
        {results.length > 0 && (
          <div className="mt-2 rounded-lg border border-border bg-surface divide-y divide-border">
            {results.map((r) => (
              <div key={r.id} className="px-4 py-2.5 text-sm">
                <span className="text-foreground">{r.statement.slice(0, 120)}</span>
                <span className="ml-2 text-xs text-muted">{r.id.slice(0, 16)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* State of Mind — composition sections (only when endpoint is available) */}
      {composition && (
        <div className="mb-8 space-y-5">
          <h2 className="text-sm font-semibold text-foreground">State of Mind</h2>

          {/* 1. Epistemic composition bar */}
          {statusEntries.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs text-muted mb-3 uppercase tracking-wide">Epistemic composition</p>
              {/* Stacked bar */}
              <div className="flex h-3 w-full overflow-hidden rounded-full gap-px mb-3">
                {statusEntries.map(({ key, count }) => {
                  const pct = statusTotal > 0 ? (count / statusTotal) * 100 : 0;
                  const color = STATUS_COLOR[key]?.bg ?? "bg-muted";
                  return (
                    <div
                      key={key}
                      className={`${color} h-full`}
                      style={{ width: `${pct}%` }}
                      title={`${STATUS_COLOR[key]?.label ?? key}: ${count}`}
                    />
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {statusEntries.map(({ key, count }) => {
                  const c = STATUS_COLOR[key];
                  return (
                    <span key={key} className="flex items-center gap-1.5 text-xs">
                      <span className={`inline-block w-2 h-2 rounded-sm ${c?.bg ?? "bg-muted"}`} />
                      <span className={c?.text ?? "text-muted"}>{c?.label ?? key}</span>
                      <span className="text-muted">{count}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. By tier */}
          {tierEntries.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs text-muted mb-3 uppercase tracking-wide">Memory by tier</p>
              <div className="flex flex-wrap gap-2">
                {tierEntries.map(({ key, count }) => {
                  const pct = tierTotal > 0 ? Math.round((count / tierTotal) * 100) : 0;
                  const barColor = TIER_COLOR[key] ?? "bg-muted/50";
                  return (
                    <div key={key} className="flex flex-col items-center gap-1 min-w-[64px]">
                      <div className="w-full rounded border border-border bg-surface/50 h-1.5 overflow-hidden">
                        <div className={`${barColor} h-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-foreground font-medium">{count}</span>
                      <span className="text-[10px] text-muted capitalize">{key}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Beliefs revised this week */}
          <div className="rounded-lg border border-border bg-surface px-4 py-3 flex items-center gap-3">
            {composition.memories_changed_7d > 0 ? (
              <>
                <span className="text-2xl font-bold text-accent">{composition.memories_changed_7d}</span>
                <span className="text-sm text-muted">beliefs revised in the last 7 days</span>
              </>
            ) : (
              <span className="text-sm text-muted">No beliefs revised this week.</span>
            )}
          </div>
        </div>
      )}

      {/* Stat cards — secondary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-8">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-surface p-3">
            <div className="text-xl font-semibold text-foreground">{c.value.toLocaleString()}</div>
            <div className="text-xs text-muted">{c.label}</div>
            <div className="text-[10px] text-muted/60">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Activity Feed */}
      <h2 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h2>
      <div className="rounded-lg border border-border bg-surface divide-y divide-border">
        {events.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted text-center">No events yet.</div>
        ) : (
          events.map((e) => (
            <div key={e.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
              <span className="text-xs text-muted font-mono w-8">{e.seq}</span>
              <span className="text-accent text-xs font-mono w-40 truncate">
                {e.type.split(".").slice(-2).join(".")}
              </span>
              <span className="text-muted text-xs truncate flex-1">
                {e.subject || (e.data as Record<string, any>)?.statement || (e.data as Record<string, any>)?.mem_id || (e.data as Record<string, any>)?.epi_id || "—"}
              </span>
              <span className="text-xs text-muted/60">
                {new Date(e.created_at).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
