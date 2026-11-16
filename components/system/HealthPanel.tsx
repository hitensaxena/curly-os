"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSystems, trigger } from "@/lib/curlyos";
import type {
  EngineTriggerResult,
  SystemEngine,
  SystemsStatus,
} from "@/lib/curlyos-types";
import { relTime } from "@/lib/format";

// Keyed by the engine registry's own names. It used to key on the five
// hand-written pseudo-engines the API used to report ("consolidation",
// "reflection", "meta"), none of which matched a real engine, so no trigger
// button ever rendered.
const ENGINE_TRIGGERS: Record<
  string,
  { label: string; path: string; body?: Record<string, unknown> }[]
> = {
  consolidation_fast: [
    { label: "Run fast", path: "/api/consolidation/run", body: { mode: "fast" } },
  ],
  consolidation_deep: [
    { label: "Run deep", path: "/api/consolidation/run", body: { mode: "deep" } },
  ],
  reflection_weekly: [{ label: "Run weekly", path: "/api/reflection/weekly" }],
  reflection_monthly: [{ label: "Run monthly", path: "/api/reflection/monthly" }],
  meta_audit: [{ label: "Audit", path: "/api/meta/audit" }],
  narrative_generate: [{ label: "Generate", path: "/api/narrative/generate" }],
  attention_scan: [{ label: "Scan", path: "/api/attention/scan" }],
};

type TriggerState = {
  running: boolean;
  label: string;
  result?: EngineTriggerResult;
};

function whenLabel(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? "—" : relTime(ms);
}

// relTime() is past-only; a next_due is in the future and needs its own label.
function dueLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const m = Math.round((ms - Date.now()) / 60000);
  if (m <= 0) return "now";
  if (m < 60) return `in ${m}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `in ${h}h` : `in ${Math.round(h / 24)}d`;
}

function whenAbsolute(iso: string | null | undefined): string {
  if (!iso) return "no recorded runs";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function SystemsPage() {
  const [data, setData] = useState<SystemsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [triggers, setTriggers] = useState<Record<string, TriggerState>>({});

  const refresh = useCallback(async () => {
    try {
      const d = await getSystems();
      setData(d);
    } catch {
      // keep last good data; transient proxy hiccups shouldn't blank the dashboard
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  async function runTrigger(
    engine: string,
    t: { label: string; path: string; body?: Record<string, unknown> },
  ) {
    setTriggers((prev) => ({ ...prev, [engine]: { running: true, label: t.label } }));
    try {
      const result = await trigger(t.path, t.body ?? {});
      setTriggers((prev) => ({ ...prev, [engine]: { running: false, label: t.label, result } }));
      if (!result?.error) refresh();
    } catch (e) {
      setTriggers((prev) => ({
        ...prev,
        [engine]: { running: false, label: t.label, result: { error: String(e) } },
      }));
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-muted">Loading...</div>;

  const infra = data?.infrastructure ?? [];
  const engines = data?.engines ?? [];
  const stats = data?.stats;
  const statTiles = stats
    ? [
        { label: "Episodes", value: stats.episodes },
        { label: "Memories", value: stats.memories },
        { label: "Identity facts", value: stats.identity_facts },
        { label: "Entities", value: stats.knowledge_entities },
        { label: "Edges", value: stats.knowledge_edges },
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Systems</h1>
      <p className="text-sm text-muted mb-6">Live status of every CurlyOS subsystem and autonomous engine</p>

      {/* Cognitive heartbeat — the background scheduler that drives every engine */}
      {data?.scheduler && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-foreground mb-2">Background jobs</h2>
          <Link
            href="/logs?tab=jobs"
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
          >
            <span className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  !data.scheduler.running
                    ? "bg-red-400"
                    : data.scheduler.failing.length > 0
                      ? "bg-yellow-400"
                      : "bg-green-400"
                }`}
              />
              <span className="text-sm font-medium text-foreground">
                {data.scheduler.running ? "Scheduler running" : "Scheduler stopped"}
              </span>
            </span>
            <span className="text-xs text-muted tabular-nums">
              {data.scheduler.jobs} {data.scheduler.jobs === 1 ? "job" : "jobs"}
            </span>
            <span
              className={`text-xs tabular-nums ${
                data.scheduler.failing.length > 0 ? "text-yellow-400" : "text-muted"
              }`}
            >
              {data.scheduler.failing.length} failing
              {data.scheduler.failing.length > 0 ? `: ${data.scheduler.failing.join(", ")}` : ""}
            </span>
            <span className="text-xs text-muted" title={whenAbsolute(data.scheduler.next_due)}>
              next due {dueLabel(data.scheduler.next_due)}
            </span>
            <span className="ml-auto text-xs text-accent">runs →</span>
          </Link>
        </section>
      )}

      {/* Infrastructure */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-2">Infrastructure</h2>
        {infra.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {infra.map((s) => (
              <div key={s.name} className="rounded-lg border border-border bg-surface px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${s.ok ? "bg-green-400" : "bg-red-400"}`} />
                  <span className="text-sm font-medium text-foreground capitalize">{s.name.replace(/_/g, " ")}</span>
                </div>
                <p className="text-[11px] text-muted mt-1 break-words">{s.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No infrastructure reported.</p>
        )}
      </section>

      {/* Stats strip */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-2">Counters</h2>
        {statTiles.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {statTiles.map((t) => (
              <div key={t.label} className="rounded-lg border border-border bg-surface px-3 py-2">
                <div className="text-lg font-semibold text-foreground tabular-nums">{t.value}</div>
                <div className="text-[10px] text-muted uppercase tracking-wide">{t.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No counters available.</p>
        )}
      </section>

      {/* Autonomous engines */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-2">Autonomous Engines</h2>
        {engines.length > 0 ? (
          <div className="space-y-3">
            {engines.map((eng) => (
              <EngineCard
                key={eng.name}
                eng={eng}
                expanded={!!expanded[eng.name]}
                onToggle={() => setExpanded((p) => ({ ...p, [eng.name]: !p[eng.name] }))}
                trig={triggers[eng.name]}
                onRun={(t) => runTrigger(eng.name, t)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No engines reported.</p>
        )}
      </section>
    </div>
  );
}

function EngineCard({
  eng,
  expanded,
  onToggle,
  trig,
  onRun,
}: {
  eng: SystemEngine;
  expanded: boolean;
  onToggle: () => void;
  trig?: TriggerState;
  onRun: (t: { label: string; path: string; body?: Record<string, unknown> }) => void;
}) {
  const buttons = ENGINE_TRIGGERS[eng.name] ?? [];
  const recent = eng.recent ?? [];
  const resultErr = trig?.result?.error;
  const title = eng.name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {eng.enabled === false && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
                disabled
              </span>
            )}
          </div>
          {eng.error ? (
            <p className="text-xs text-red-400 mt-1">{eng.error}</p>
          ) : (
            <>
              {eng.label && <p className="text-xs text-muted mt-1">{eng.label}</p>}
              <p className="text-xs text-muted mt-1" title={whenAbsolute(eng.last_run)}>
                {eng.schedule ? `${eng.schedule} · ` : ""}
                last run {whenLabel(eng.last_run)}
                {eng.last_status && eng.last_status !== "never" ? ` · ${eng.last_status}` : ""}
              </p>
              {eng.last_error && <p className="text-xs text-red-400 mt-1">{eng.last_error}</p>}
            </>
          )}
        </div>
      </div>

      {/* Triggers */}
      {buttons.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {buttons.map((b) => (
            <button
              key={b.label}
              onClick={() => onRun(b)}
              disabled={trig?.running}
              className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {b.label}
            </button>
          ))}
          {trig?.running && (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              running {trig.label}…
            </span>
          )}
        </div>
      )}

      {/* Trigger result */}
      {trig && !trig.running && trig.result && (
        <details className="mt-3">
          <summary className={`cursor-pointer text-xs ${resultErr ? "text-red-400" : "text-accent"}`}>
            {resultErr ? `${trig.label} failed` : `${trig.label} result`}
          </summary>
          <pre className={`mt-2 max-h-72 overflow-auto rounded-md border border-border bg-surface-2 p-3 text-[11px] leading-relaxed whitespace-pre-wrap ${resultErr ? "text-red-400" : "text-muted"}`}>
            {JSON.stringify(trig.result, null, 2)}
          </pre>
        </details>
      )}

      {/* Recent activity */}
      {recent.length > 0 && (
        <div className="mt-3">
          <button onClick={onToggle} className="text-xs text-muted hover:text-foreground transition-colors">
            {expanded ? "Hide" : "Show"} recent activity ({recent.length})
          </button>
          {expanded && (
            <div className="mt-2 space-y-1">
              {recent.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2 text-xs">
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-accent">{ev.type}</span>
                  <span className="text-[10px] text-muted" title={whenAbsolute(ev.created_at)}>
                    {whenLabel(ev.created_at)}
                  </span>
                  {ev.subject && <span className="text-muted truncate">{ev.subject}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
