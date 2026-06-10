"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getEvents, getLogs, getLogSources } from "@/lib/curlyos";
import type { EventItem, LogResponse, LogSource } from "@/lib/curlyos-types";
import { relTime } from "@/lib/format";

type Tab = "server" | "activity";

const EVENTS_LIMIT = 100;

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function whenLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? "—" : relTime(ms);
}

export default function LogsPage() {
  const [tab, setTab] = useState<Tab>("server");

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Logs</h1>
      <p className="text-sm text-muted mb-6">Latest server logs and the live activity feed</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {([
          { id: "server", label: "Server logs" },
          { id: "activity", label: "Activity feed" },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === t.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "server" && <ServerLogs />}
      {tab === "activity" && <ActivityFeed />}
    </div>
  );
}

function ServerLogs() {
  const [sources, setSources] = useState<LogSource[]>([]);
  const [source, setSource] = useState<string>("");
  const [data, setData] = useState<LogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  // Load the list of sources once and pick a sensible default.
  useEffect(() => {
    getLogSources().then(({ sources }) => {
      setSources(sources);
      if (sources.length > 0) {
        const first = sources.find((s) => s.exists) ?? sources[0];
        setSource(first.name);
      }
    });
  }, []);

  const load = useCallback(async (name: string) => {
    if (!name) return;
    setLoading(true);
    try {
      const d = await getLogs(name, 300);
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(source);
  }, [source, load]);

  // Auto-scroll the terminal to the newest line whenever content changes.
  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [data]);

  // Auto-refresh poll.
  useEffect(() => {
    if (!autoRefresh || !source) return;
    const id = setInterval(() => load(source), 5000);
    return () => clearInterval(id);
  }, [autoRefresh, source, load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        >
          {sources.length === 0 && <option value="">No sources</option>}
          {sources.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} ({fmtBytes(s.size_bytes)})
            </option>
          ))}
        </select>

        <button
          onClick={() => load(source)}
          disabled={loading || !source}
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>

        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="accent-accent"
          />
          Auto-refresh (5s)
        </label>
      </div>

      {data && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
          <span className="font-mono">{data.path}</span>
          <span>{fmtBytes(data.size_bytes)}</span>
          <span title={data.modified ?? undefined}>modified {whenLabel(data.modified)}</span>
          <span>{data.count} lines</span>
        </div>
      )}

      {data && !data.exists ? (
        <p className="text-sm text-muted">Log file not created yet.</p>
      ) : data?.error ? (
        <p className="text-sm text-red-400">{data.error}</p>
      ) : (
        <pre
          ref={preRef}
          className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap"
        >
          {data?.lines.length ? data.lines.join("\n") : loading ? "Loading…" : "(empty)"}
        </pre>
      )}
    </div>
  );
}

function ActivityFeed() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadPage = useCallback(async (off: number, append: boolean) => {
    setLoading(true);
    try {
      const { items } = await getEvents(EVENTS_LIMIT, off);
      setEvents((prev) => (append ? [...prev, ...items] : items));
      setHasMore(items.length === EVENTS_LIMIT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage(0, false);
  }, [loadPage]);

  const shown = filter.trim()
    ? events.filter((e) => e.type.toLowerCase().includes(filter.trim().toLowerCase()))
    : events;

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by type…"
        className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted"
      />

      {loading && events.length === 0 ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted">No events{filter.trim() ? " match this filter." : " yet."}</p>
      ) : (
        <div className="space-y-1">
          {shown.map((ev) => {
            const chip = ev.type.split(".").pop() || ev.type;
            const open = !!expanded[ev.id];
            return (
              <div key={ev.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-accent"
                    title={ev.type}
                  >
                    {chip}
                  </span>
                  <span className="text-[10px] text-muted" title={ev.created_at}>
                    {whenLabel(ev.created_at)}
                  </span>
                  {ev.subject && <span className="text-xs text-muted truncate">{ev.subject}</span>}
                  <button
                    onClick={() => setExpanded((p) => ({ ...p, [ev.id]: !p[ev.id] }))}
                    className="ml-auto text-[10px] text-muted hover:text-foreground transition-colors"
                  >
                    {open ? "hide" : "data"}
                  </button>
                </div>
                {open && (
                  <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-border bg-surface-2 p-2 text-[10px] leading-relaxed text-muted whitespace-pre-wrap">
                    {JSON.stringify(ev.data, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => {
            const next = offset + EVENTS_LIMIT;
            setOffset(next);
            loadPage(next, true);
          }}
          disabled={loading}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
