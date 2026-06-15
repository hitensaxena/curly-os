"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeading } from "@/components/ui/PageHeading";
import { GoalWorkspace, ProgressBar, planBadge } from "@/components/orchestrator/GoalWorkspace";
import { useEventStream } from "@/lib/use-event-stream";
import {
  getGoals,
  getOrchestratorOverview,
  getAgentBypass,
  setAgentBypass,
  getAutoPlan,
  setAutoPlan,
  runAutoplan,
  getAutoPromote,
  setAutoPromote,
} from "@/lib/curlyos";
import type {
  Goal,
  OrchestratorOverview,
  OrchestratorGoal,
} from "@/lib/curlyos-types";

// ── page ──────────────────────────────────────────────────────────────────────

export default function OrchestratorPage() {
  const [overview, setOverview] = useState<OrchestratorOverview | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const reload = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadOverview = useCallback(() => {
    getOrchestratorOverview().then(setOverview).catch(() => {});
  }, []);

  useEffect(() => {
    loadOverview();
    getGoals("active").then((d) => setGoals(d.items)).catch(() => {});
  }, [loadOverview]);

  // Deep-link: /orchestrator?goal=<id> selects that goal. Read once on mount to
  // avoid the Suspense requirement of useSearchParams.
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("goal");
    if (g) setSelectedId(g);
  }, []);

  // auto-select the first orchestrated goal (unless a deep-link already chose one)
  useEffect(() => {
    if (!selectedId && overview?.goals.length) setSelectedId(overview.goals[0].goal_id);
  }, [overview, selectedId]);

  useEventStream(["agent", "goal", "safety"], () => {
    if (reload.current) clearTimeout(reload.current);
    reload.current = setTimeout(loadOverview, 800);
  });

  const orchestrated: OrchestratorGoal[] = overview?.goals ?? [];
  const selGoalRef: { title: string; progress: number } | undefined = (() => {
    const o = orchestrated.find((g) => g.goal_id === selectedId);
    if (o) return { title: o.title, progress: o.progress };
    const g = goals.find((x) => x.id === selectedId);
    return g ? { title: g.title, progress: g.progress } : undefined;
  })();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <PageHeading
        title="Orchestrator"
        eyebrow="Goal execution"
        subtitle={
          overview
            ? `${orchestrated.length} orchestrated · ${overview.active_runs.length} working · ${overview.pending_approvals} approvals`
            : "Loading…"
        }
        actions={<HeaderToggles onAutoplanned={loadOverview} />}
      />

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          <GoalRail
            goals={orchestrated}
            allGoals={goals}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
          />
        </aside>

        <main className="min-w-0">
          {!selGoalRef ? (
            <div className="rounded-lg border border-border bg-surface p-10 text-center text-sm text-muted">
              Select a goal on the left, or let the orchestrator plan one.
            </div>
          ) : (
            <GoalWorkspace
              key={selectedId}
              goalId={selectedId}
              title={selGoalRef.title}
              progress={selGoalRef.progress}
              onChanged={loadOverview}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ── header toggles (auto-promote + auto-plan + bypass + plan-now) ──────────────

function HeaderToggles({ onAutoplanned }: { onAutoplanned: () => void }) {
  const [bypass, setBypass] = useState<boolean | null>(null);
  const [autoplan, setAutoplan] = useState<boolean | null>(null);
  const [autopromote, setAutopromote] = useState<boolean | null>(null);
  const [planning, setPlanning] = useState(false);

  useEffect(() => {
    getAgentBypass().then((d) => setBypass(d.bypass)).catch(() => setBypass(false));
    getAutoPlan().then((d) => setAutoplan(d.auto_plan)).catch(() => setAutoplan(true));
    getAutoPromote().then((d) => setAutopromote(d.auto_promote)).catch(() => setAutopromote(true));
  }, []);

  const planNow = async () => {
    setPlanning(true);
    try { await runAutoplan(); onAutoplanned(); } finally { setPlanning(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <MiniToggle
        label="Auto-promote" on={autopromote} amber={false}
        onToggle={async () => { const d = await setAutoPromote(!autopromote); setAutopromote(d.auto_promote); }}
      />
      <MiniToggle
        label="Auto-plan" on={autoplan} amber={false}
        onToggle={async () => { const d = await setAutoPlan(!autoplan); setAutoplan(d.auto_plan); }}
      />
      <MiniToggle
        label="Bypass" on={bypass} amber
        onToggle={async () => { const d = await setAgentBypass(!bypass); setBypass(d.bypass); }}
      />
      <button
        onClick={planNow}
        disabled={planning}
        className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-2 disabled:opacity-50"
      >
        {planning ? "Planning…" : "Plan now"}
      </button>
    </div>
  );
}

function MiniToggle({
  label, on, amber, onToggle,
}: { label: string; on: boolean | null; amber: boolean; onToggle: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const click = async () => { if (on === null || busy) return; setBusy(true); try { await onToggle(); } finally { setBusy(false); } };
  return (
    <button onClick={click} disabled={on === null || busy} className="flex items-center gap-1.5 disabled:opacity-50" title={`${label}: ${on ? "on" : "off"}`}>
      <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? (amber ? "bg-amber-500" : "bg-accent") : "bg-surface-2 border border-border"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
      <span className={`text-[11px] ${on ? (amber ? "text-amber-400" : "text-accent") : "text-muted"}`}>{label}</span>
    </button>
  );
}

// ── goal rail ─────────────────────────────────────────────────────────────────

function GoalRail({
  goals, allGoals, selectedId, onSelect,
}: {
  goals: OrchestratorGoal[];
  allGoals: Goal[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const orchestratedIds = new Set(goals.map((g) => g.goal_id));
  const others = allGoals.filter((g) => !orchestratedIds.has(g.id));

  return (
    <>
      {goals.map((g) => {
        const b = planBadge(g.plan_status);
        return (
          <button
            key={g.goal_id}
            onClick={() => onSelect(g.goal_id)}
            className={`block w-full rounded-lg border bg-surface p-3 text-left transition-colors ${
              selectedId === g.goal_id ? "border-accent" : "border-border hover:border-border-soft"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-xs font-medium text-foreground">{g.title}</p>
              {g.active_tasks > 0 && <span className="mt-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />}
            </div>
            <div className="mt-2"><ProgressBar value={g.progress} thin /></div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className={`rounded border px-1 py-0.5 text-[9px] font-mono ${b.cls}`}>{b.label}</span>
              <span className="font-mono text-[9px] text-muted">{g.completed_tasks}/{g.total_tasks}</span>
            </div>
          </button>
        );
      })}

      {others.length > 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface/50 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Bring a goal in</p>
          <select
            value=""
            onChange={(e) => e.target.value && onSelect(e.target.value)}
            className="w-full rounded border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
          >
            <option value="">Pick a goal…</option>
            {others.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </div>
      )}
    </>
  );
}
