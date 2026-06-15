"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/PageHeading";
import { JobActivity } from "@/components/jobs/JobActivity";
import { useEventStream } from "@/lib/use-event-stream";
import {
  getGoals,
  getOrchestratorOverview,
  getGoalPlan,
  getGoalArtifacts,
  getArtifacts,
  decomposeGoal,
  approvePlan,
  dispatchTask,
  executePlan,
  orchestratorChat,
  getOrchestratorMessages,
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
  GoalPlan,
  GoalTask,
  GoalTaskStatus,
  GoalArtifact,
  Artifact,
  OrchestratorOverview,
  OrchestratorGoal,
  OrchestratorMessage,
  SseEvent,
} from "@/lib/curlyos-types";
import { ArtifactList } from "@/components/hierarchy/ArtifactList";

type Tab = "conversation" | "plan" | "artifacts" | "studio";

// ── small shared bits ───────────────────────────────────────────────────────

function ProgressBar({ value, thin }: { value: number; thin?: boolean }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 overflow-hidden rounded-full bg-surface-2 ${thin ? "h-1" : "h-2"}`}>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-[10px] text-muted">{pct}%</span>
    </div>
  );
}

const TASK_CHIP: Record<GoalTaskStatus, string> = {
  pending: "text-muted bg-surface-2 border-border",
  dispatched: "text-accent bg-accent/10 border-accent/30",
  running: "text-accent bg-accent/10 border-accent/30",
  parked: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  verifying: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  completed: "text-green-400 bg-green-400/10 border-green-400/30",
  failed: "text-red-400 bg-red-400/10 border-red-400/30",
  skipped: "text-muted bg-surface-2 border-border",
};

const TASK_LABEL: Partial<Record<GoalTaskStatus, string>> = {
  parked: "needs approval",
  verifying: "verifying",
  completed: "verified ✓",
};

function TaskChip({ status }: { status: GoalTaskStatus }) {
  const label = TASK_LABEL[status] ?? status;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono ${TASK_CHIP[status]}`}>
      {(status === "running" || status === "verifying") && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {label}
    </span>
  );
}

// A small "attempt 2/3" pill — only shown once a task has been retried.
function AttemptPill({ attempt, max }: { attempt: number; max: number }) {
  if (!attempt) return null;
  return (
    <span className="inline-flex items-center rounded border border-orange-400/30 bg-orange-400/10 px-1.5 py-0.5 text-[10px] font-mono text-orange-400">
      ⟳ attempt {attempt + 1}/{max + 1}
    </span>
  );
}

function planBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case "proposed": return { label: "Plan ready", cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" };
    case "approved": return { label: "Approved", cls: "text-accent bg-accent/10 border-accent/30" };
    case "executing": return { label: "Executing", cls: "text-accent bg-accent/10 border-accent/30" };
    case "done": return { label: "Done", cls: "text-green-400 bg-green-400/10 border-green-400/30" };
    default: return { label: status, cls: "text-muted bg-surface-2 border-border" };
  }
}

const ART_META: Record<string, { icon: string; cls: string }> = {
  memory: { icon: "◆", cls: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  decision: { icon: "⚖", cls: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
  subgoal: { icon: "◎", cls: "text-green-400 border-green-400/30 bg-green-400/10" },
  sketch: { icon: "✎", cls: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  notification: { icon: "🔔", cls: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10" },
};

// ── page ──────────────────────────────────────────────────────────────────────

export default function OrchestratorPage() {
  const [overview, setOverview] = useState<OrchestratorOverview | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("conversation");
  const reload = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadOverview = useCallback(() => {
    getOrchestratorOverview().then(setOverview).catch(() => {});
  }, []);

  useEffect(() => {
    loadOverview();
    getGoals("active").then((d) => setGoals(d.items)).catch(() => {});
  }, [loadOverview]);

  // Deep-link: /orchestrator?goal=<id> (e.g. arriving from a project's studio)
  // selects that goal directly. Read once on mount to avoid the Suspense
  // requirement of useSearchParams.
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
        {/* Left rail — orchestrated goals */}
        <aside className="space-y-3">
          <GoalRail
            goals={orchestrated}
            allGoals={goals}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); setTab("conversation"); }}
          />
        </aside>

        {/* Main pane — selected goal workspace */}
        <main className="min-w-0">
          {!selGoalRef ? (
            <div className="rounded-lg border border-border bg-surface p-10 text-center text-sm text-muted">
              Select a goal on the left, or let the orchestrator plan one.
            </div>
          ) : (
            <GoalWorkspace
              key={selectedId}
              goalId={selectedId}
              ref0={selGoalRef}
              tab={tab}
              setTab={setTab}
              onChanged={loadOverview}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ── header toggles (bypass + autoplan + plan-now) ─────────────────────────────

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

// ── goal workspace (header + tabs) ────────────────────────────────────────────

function GoalWorkspace({
  goalId, ref0, tab, setTab, onChanged,
}: {
  goalId: string;
  ref0: { title: string; progress: number };
  tab: Tab;
  setTab: (t: Tab) => void;
  onChanged: () => void;
}) {
  const [plan, setPlan] = useState<GoalPlan | null>(null);
  const [artifacts, setArtifacts] = useState<GoalArtifact[]>([]);
  const [studio, setStudio] = useState<Artifact[]>([]);
  const reload = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPlan = useCallback(() => {
    getGoalPlan(goalId).then((d) => setPlan(d.plan)).catch(() => setPlan(null));
  }, [goalId]);
  const loadArtifacts = useCallback(() => {
    getGoalArtifacts(goalId).then((d) => setArtifacts(d.items)).catch(() => {});
  }, [goalId]);
  const loadStudio = useCallback(() => {
    getArtifacts({ goalId }).then((d) => setStudio(d.items)).catch(() => {});
  }, [goalId]);

  useEffect(() => { loadPlan(); loadArtifacts(); loadStudio(); }, [loadPlan, loadArtifacts, loadStudio]);

  useEventStream(["agent", "goal"], (evt: SseEvent) => {
    if (reload.current) clearTimeout(reload.current);
    reload.current = setTimeout(() => { loadPlan(); loadArtifacts(); loadStudio(); onChanged(); }, 800);
  });

  const refresh = () => { loadPlan(); loadArtifacts(); loadStudio(); onChanged(); };
  const b = planBadge(plan?.status ?? "—");
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); refresh(); } finally { setBusy(false); } };

  const tabs: { id: Tab; label: string; n?: number }[] = [
    { id: "conversation", label: "Conversation" },
    { id: "plan", label: "Plan", n: plan?.tasks.length },
    { id: "studio", label: "Studio", n: studio.length },
    { id: "artifacts", label: "Activity", n: artifacts.length },
  ];

  return (
    <div className="rounded-lg border border-border bg-surface">
      {/* header */}
      <div className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{ref0.title}</h2>
            <div className="mt-2 w-56"><ProgressBar value={ref0.progress} /></div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {plan && <span className={`rounded border px-1.5 py-0.5 text-[10px] font-mono ${b.cls}`}>{b.label}</span>}
            {plan?.status === "proposed" && (
              <button
                disabled={busy}
                onClick={() => act(() => executePlan(plan.id))}
                className="rounded bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent/80 disabled:opacity-40"
              >
                Execute plan
              </button>
            )}
            {!plan && (
              <button
                disabled={busy}
                onClick={() => act(() => decomposeGoal(goalId))}
                className="rounded bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent/80 disabled:opacity-40"
              >
                {busy ? "Planning…" : "Plan this goal"}
              </button>
            )}
            {plan && (
              <button
                disabled={busy}
                onClick={() => act(() => decomposeGoal(goalId))}
                className="rounded border border-border px-2.5 py-1.5 text-xs text-muted hover:text-foreground disabled:opacity-40"
              >
                Re-plan
              </button>
            )}
          </div>
        </div>

        {/* tabs */}
        <div className="mt-3 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1.5 text-xs transition-colors ${
                tab === t.id ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}{typeof t.n === "number" && t.n > 0 ? ` (${t.n})` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {tab === "conversation" && (
          <ConversationTab goalId={goalId} plan={plan} artifacts={artifacts} onActed={refresh} busy={busy} act={act} />
        )}
        {tab === "plan" && <PlanTab plan={plan} onChanged={refresh} />}
        {tab === "studio" && (
          <ArtifactList
            artifacts={studio}
            emptyHint="No deliverables yet. As workers write files and make things for this goal, they land here."
          />
        )}
        {tab === "artifacts" && <ArtifactsList artifacts={artifacts} />}
      </div>
    </div>
  );
}

// ── conversation tab (messages + artifacts + plan card + chat) ────────────────

type FeedItem =
  | { kind: "msg"; at: number; m: OrchestratorMessage }
  | { kind: "artifact"; at: number; a: GoalArtifact };

function ConversationTab({
  goalId, plan, artifacts, onActed, busy, act,
}: {
  goalId: string;
  plan: GoalPlan | null;
  artifacts: GoalArtifact[];
  onActed: () => void;
  busy: boolean;
  act: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [messages, setMessages] = useState<OrchestratorMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    getOrchestratorMessages(goalId).then((d) => setMessages(d.items)).catch(() => {});
  }, [goalId]);
  useEffect(() => { load(); }, [load]);

  const feed: FeedItem[] = [
    ...messages.map((m) => ({ kind: "msg" as const, at: m.created_at ? Date.parse(m.created_at) : 0, m })),
    ...artifacts.map((a) => ({ kind: "artifact" as const, at: a.created_at ? Date.parse(a.created_at) : 0, a })),
  ].sort((x, y) => x.at - y.at);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages, artifacts]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setSending(true);
    setMessages((m) => [...m, { id: `tmp${m.length}`, role: "user", content: msg, meta: {}, created_at: new Date().toISOString() }]);
    setInput("");
    try { await orchestratorChat(msg, goalId); load(); onActed(); }
    catch { setMessages((m) => [...m, { id: `e${m.length}`, role: "orchestrator", content: "That failed — try again.", meta: {}, created_at: null }]); }
    finally { setSending(false); }
  };

  return (
    <div className="flex h-[460px] flex-col">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto pr-1">
        {feed.length === 0 && (
          <p className="text-xs text-muted">
            Talk to the orchestrator about this goal — &ldquo;break this down&rdquo;, &ldquo;execute&rdquo;,
            &ldquo;how&rsquo;s it going?&rdquo;. Artifacts your workers produce show up here too.
          </p>
        )}
        {feed.map((f) =>
          f.kind === "msg" ? (
            <div key={f.m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
              f.m.role === "user" ? "ml-auto bg-accent/15 text-foreground" : "bg-surface-2 text-foreground"
            }`}>
              {f.m.content}
              {typeof f.m.meta?.action === "string" && f.m.meta.action !== "none" && (
                <span className="mt-1 block font-mono text-[9px] text-muted">→ {f.m.meta.action}</span>
              )}
            </div>
          ) : (
            <ArtifactCard key={`${f.a.run_id}-${f.at}`} a={f.a} inline />
          ),
        )}
        {sending && <p className="text-[10px] text-muted">orchestrator is thinking…</p>}
      </div>

      {/* plan card */}
      {plan?.status === "proposed" && (
        <div className="my-2 rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-3">
          <p className="text-xs font-semibold text-foreground">Proposed plan — {plan.tasks.length} tasks</p>
          {plan.rationale && <p className="mt-0.5 text-[11px] text-muted">{plan.rationale}</p>}
          <ol className="mt-1.5 space-y-0.5">
            {plan.tasks.map((t) => (
              <li key={t.id} className="text-[11px] text-muted">{t.seq + 1}. {t.title}</li>
            ))}
          </ol>
          <button
            disabled={busy}
            onClick={() => act(() => executePlan(plan.id))}
            className="mt-2 rounded bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent/80 disabled:opacity-40"
          >
            Execute plan
          </button>
        </div>
      )}

      <div className="mt-2 flex gap-2 border-t border-border pt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message the orchestrator about this goal…"
          className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button onClick={send} disabled={sending || !input.trim()} className="rounded bg-accent px-3 py-2 text-sm text-white hover:bg-accent/80 disabled:opacity-40">
          Send
        </button>
      </div>
    </div>
  );
}

// ── plan tab ──────────────────────────────────────────────────────────────────

function PlanTab({ plan, onChanged }: { plan: GoalPlan | null; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!plan) return <p className="text-xs text-muted">No plan yet. Use &ldquo;Plan this goal&rdquo; above.</p>;
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); onChanged(); } finally { setBusy(false); } };

  return (
    <div className="space-y-3">
      {plan.rationale && <p className="rounded border border-border bg-surface-2/40 p-2 text-xs text-muted">{plan.rationale}</p>}
      <div className="space-y-2">
        {plan.tasks.map((t) => <TaskRow key={t.id} task={t} planStatus={plan.status} onChanged={onChanged} />)}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {plan.status === "proposed" && (
          <button disabled={busy} onClick={() => act(() => approvePlan(plan.id))} className="rounded bg-green-500/80 px-3 py-1.5 text-sm text-white hover:bg-green-500 disabled:opacity-40">Approve</button>
        )}
        {plan.status !== "done" && (
          <button disabled={busy} onClick={() => act(() => executePlan(plan.id))} className="rounded bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/80 disabled:opacity-40">Execute all</button>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, planStatus, onChanged }: { task: GoalTask; planStatus: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const live = task.status === "running" || task.status === "parked" || task.status === "verifying";
  const canDispatch = task.status === "pending" && (planStatus === "approved" || planStatus === "executing");
  const verdict = task.verdict;
  const failedVerify = verdict && !verdict.passed;

  return (
    <div className="rounded border border-border bg-surface-2/30 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-[10px] text-muted">{task.seq + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-foreground">{task.title}</span>
            <TaskChip status={task.status} />
            <AttemptPill attempt={task.attempt} max={task.max_attempts} />
          </div>
          <p className="mt-0.5 text-xs text-muted">{task.task}</p>
          {task.verify && (
            <p className="mt-1 text-[11px] text-muted">
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted/70">check </span>
              {task.verify}
            </p>
          )}
          {/* The verifier's critique — why it passed or what the retry must fix. */}
          {verdict && (
            <p className={`mt-1 rounded border px-2 py-1 text-[11px] ${
              verdict.passed
                ? "border-green-400/20 bg-green-400/5 text-green-400/90"
                : "border-orange-400/25 bg-orange-400/5 text-orange-400/90"
            }`}>
              {verdict.passed ? "✓ verified: " : (task.status === "failed" ? "✗ gave up: " : "↻ retrying: ")}
              {verdict.critique || (verdict.passed ? "meets the success criteria" : "did not meet the success criteria")}
            </p>
          )}
          {(live || open) && task.run_id && (
            <div className="mt-2 rounded border border-border bg-surface/60 p-2">
              <JobActivity runId={task.run_id} onTerminal={() => onChanged()} />
            </div>
          )}
          {task.status === "completed" && task.result_summary && (
            <button onClick={() => setOpen((v) => !v)} className="mt-1 text-[11px] text-accent hover:underline">
              {open ? "hide" : "show"} result
            </button>
          )}
          {open && task.result_summary && (
            <p className="mt-1 whitespace-pre-wrap rounded border border-border bg-surface/60 p-2 text-xs text-foreground">{task.result_summary}</p>
          )}
        </div>
        {canDispatch && (
          <button disabled={busy} onClick={async () => { setBusy(true); try { await dispatchTask(task.id); onChanged(); } finally { setBusy(false); } }}
            className="shrink-0 rounded border border-border px-2 py-0.5 text-[11px] text-foreground hover:bg-surface-2 disabled:opacity-40">
            {busy ? "…" : "Run"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── artifacts ─────────────────────────────────────────────────────────────────

function ArtifactsList({ artifacts }: { artifacts: GoalArtifact[] }) {
  if (artifacts.length === 0) return <p className="text-xs text-muted">No artifacts yet. They appear as workers produce memories, decisions, sketches and notes.</p>;
  return <div className="space-y-2">{artifacts.map((a, i) => <ArtifactCard key={i} a={a} />)}</div>;
}

function ArtifactCard({ a, inline }: { a: GoalArtifact; inline?: boolean }) {
  const m = ART_META[a.type] ?? { icon: "•", cls: "text-muted border-border bg-surface-2" };
  return (
    <div className={`rounded-lg border bg-surface p-3 ${inline ? "max-w-[92%] border-border" : "border-border"}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded border text-[10px] ${m.cls}`}>{m.icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">{a.type}</span>
        {a.created_at && <span className="ml-auto font-mono text-[9px] text-muted">{new Date(a.created_at).toLocaleString()}</span>}
      </div>
      <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-xs text-foreground">{a.summary || "(no content)"}</p>
      {a.run_id && (
        <Link href={`/runs/${a.run_id}`} className="mt-1.5 inline-block text-[10px] text-muted hover:text-accent">from run &#8250;</Link>
      )}
    </div>
  );
}
