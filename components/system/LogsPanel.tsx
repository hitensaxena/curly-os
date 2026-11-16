"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAgentRuns, getEvents, getLogs, getLogSources, getScheduler, runJobNow } from "@/lib/curlyos";
import type {
  AgentRunsResponse,
  EventItem,
  LogResponse,
  LogSource,
  SchedulerSnapshot,
} from "@/lib/curlyos-types";
import { useToast } from "@/components/ui/ToastProvider";
import { relTime } from "@/lib/format";

type Tab = "server" | "activity" | "jobs";

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

const TABS: Tab[] = ["server", "activity", "jobs"];

export default function LogsPage() {
  const [tab, setTab] = useState<Tab>("server");

  // Deep link from /systems ("runs →"). Read in an effect, not in the state
  // initializer, so server and client render the same first pass.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted && (TABS as string[]).includes(wanted)) setTab(wanted as Tab);
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl">

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {([
          { id: "server", label: "Server logs" },
          { id: "activity", label: "Activity feed" },
          { id: "jobs", label: "Scheduled runs" },
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
      {tab === "jobs" && <ScheduledRuns />}
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

// ── Scheduled runs ──────────────────────────────────────────────────────────
// The 12 background jobs and the record of what they actually did. Job state
// comes from the core's /api/scheduler (which reads agent_runs, so it survives
// a restart); history comes from /api/agent-runs.
const STATUS_STYLE: Record<string, string> = {
  completed: "text-success",
  failed: "text-danger",
  running: "text-accent",
  never: "text-muted",
  skipped_locked: "text-warning",
  skipped_period_done: "text-muted",
  disabled: "text-muted",
};

function statusClass(status: string): string {
  return STATUS_STYLE[status] ?? "text-muted";
}

function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function isStale(iso: string | null): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > 7 * 24 * 60 * 60 * 1000;
}

function ScheduledRuns() {
  const [snap, setSnap] = useState<SchedulerSnapshot | null>(null);
  const [runs, setRuns] = useState<AgentRunsResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        getScheduler(),
        getAgentRuns({ limit: 40, status: statusFilter || undefined }),
      ]);
      setSnap(s);
      setRuns(r);
    } catch {
      toast.error("Could not load job status");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function runNow(name: string) {
    setBusy(name);
    try {
      const out = await runJobNow(name);
      if (out.status === "completed") {
        toast.success(`${name} completed in ${fmtDuration(out.duration_ms)}`);
      } else if (out.status.startsWith("skipped")) {
        toast.info(`${name}: ${out.status.replace("skipped_", "").replace(/_/g, " ")}`);
      } else {
        toast.error(`${name}: ${out.status}${out.error ? ` — ${out.error}` : ""}`);
      }
      await load();
    } catch {
      toast.error(`${name} could not be started`);
    } finally {
      setBusy(null);
    }
  }

  if (loading && !snap) return <p className="text-sm text-muted">Loading…</p>;

  if (snap && !snap.running) {
    return (
      <div className="rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted">
        The scheduler is not running{safeReason(snap)} — nothing is firing on a cadence.
        Set <span className="font-mono text-foreground">CURLYOS_SCHEDULER=1</span> in the
        core&apos;s <span className="font-mono text-foreground">.env</span> and restart the API.
      </div>
    );
  }

  const failing = (snap?.jobs ?? []).filter((j) => j.last_status === "failed");

  return (
    <div className="space-y-6">
      {/* jobs */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground">Jobs</h2>
          <span className="text-xs text-muted">
            {snap?.jobs.length ?? 0} scheduled
            {failing.length > 0 && (
              <span className="text-danger"> · {failing.length} failing</span>
            )}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {snap?.history_error && (
          <p className="mb-2 text-xs text-warning">
            Run history unavailable: {snap.history_error}
          </p>
        )}

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Job</th>
                <th className="px-3 py-2 font-medium">Cadence</th>
                <th className="px-3 py-2 font-medium">Last run</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Took</th>
                <th className="px-3 py-2 font-medium">Next due</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(snap?.jobs ?? []).map((j) => (
                <tr key={j.name} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-mono text-foreground">{j.name}</td>
                  <td className="px-3 py-2 text-muted">{j.cadence}</td>
                  <td
                    className={`px-3 py-2 ${isStale(j.last_fired) ? "text-warning" : "text-muted"}`}
                    title={j.last_fired ?? undefined}
                  >
                    {j.last_fired ? whenLabel(j.last_fired) : "never"}
                  </td>
                  <td className={`px-3 py-2 ${statusClass(j.last_status)}`}>
                    {j.last_status}
                    {j.consecutive_failures > 1 && (
                      <span className="text-muted"> ×{j.consecutive_failures}</span>
                    )}
                    {j.last_error && (
                      <div className="mt-0.5 max-w-[280px] truncate text-[11px] text-danger/80" title={j.last_error}>
                        {j.last_error}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted">{fmtDuration(j.last_duration_ms)}</td>
                  <td className="px-3 py-2 text-muted" title={j.next_due ?? undefined}>
                    {j.next_due ? whenLabel(j.next_due) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => runNow(j.name)}
                      disabled={busy !== null}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
                    >
                      {busy === j.name ? "Running…" : "Run now"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          A manual run goes through the same lock and period guard as a scheduled one —
          if this period&apos;s output already exists you&apos;ll see{" "}
          <span className="font-mono">skipped_period_done</span> instead of a duplicate run.
        </p>
      </div>

      {/* history */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground">Recent runs</h2>
          <span className="text-xs text-muted">
            {runs ? `${runs.count} of ${runs.total}` : "—"}
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ml-auto rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground"
          >
            <option value="">All statuses</option>
            {Object.keys(runs?.by_status ?? {}).sort().map((s) => (
              <option key={s} value={s}>
                {s} ({runs?.by_status[s]})
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Job</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Took</th>
                <th className="px-3 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {(runs?.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-muted">
                    No runs recorded yet.
                  </td>
                </tr>
              )}
              {(runs?.items ?? []).map((r) => (
                <tr key={r.run_id} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-muted" title={r.started_at ?? undefined}>
                    {whenLabel(r.started_at)}
                  </td>
                  <td className="px-3 py-2 font-mono text-foreground">{r.job ?? r.agent}</td>
                  <td className={`px-3 py-2 ${statusClass(r.status)}`}>{r.status}</td>
                  <td className="px-3 py-2 text-muted">{fmtDuration(r.duration_ms)}</td>
                  <td className="max-w-[340px] truncate px-3 py-2 text-muted" title={r.error ?? r.task ?? ""}>
                    {r.error ?? r.task ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function safeReason(snap: SchedulerSnapshot): string {
  return snap.reason ? ` (${snap.reason})` : "";
}
