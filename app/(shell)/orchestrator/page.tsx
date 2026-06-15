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
  decomposeGoal,
  approvePlan,
  dispatchTask,
  dispatchPlan,
  orchestratorChat,
  getOrchestratorMessages,
  getPendingApprovals,
  grantApproval,
  denyApproval,
} from "@/lib/curlyos";
import type {
  Goal,
  GoalPlan,
  GoalTask,
  GoalTaskStatus,
  OrchestratorOverview,
  OrchestratorMessage,
  PendingApproval,
  SseEvent,
} from "@/lib/curlyos-types";

// ── status chips ──────────────────────────────────────────────────────────────

const TASK_CHIP: Record<GoalTaskStatus, string> = {
  pending: "text-muted bg-surface-2 border-border",
  dispatched: "text-accent bg-accent/10 border-accent/30",
  running: "text-accent bg-accent/10 border-accent/30",
  parked: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  completed: "text-green-400 bg-green-400/10 border-green-400/30",
  failed: "text-red-400 bg-red-400/10 border-red-400/30",
  skipped: "text-muted bg-surface-2 border-border",
};

function TaskChip({ status }: { status: GoalTaskStatus }) {
  const label = status === "parked" ? "needs approval" : status;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono ${TASK_CHIP[status]}`}
    >
      {status === "running" && (
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      )}
      {label}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right font-mono text-[10px] text-muted">{pct}%</span>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function OrchestratorPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [overview, setOverview] = useState<OrchestratorOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [plan, setPlan] = useState<GoalPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const reload = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadOverview = useCallback(() => {
    getOrchestratorOverview().then(setOverview).catch(() => {});
  }, []);

  const loadPlan = useCallback((goalId: string) => {
    if (!goalId) { setPlan(null); return; }
    setLoadingPlan(true);
    getGoalPlan(goalId)
      .then((d) => setPlan(d.plan))
      .catch(() => setPlan(null))
      .finally(() => setLoadingPlan(false));
  }, []);

  useEffect(() => {
    getGoals("active").then((d) => setGoals(d.items)).catch(() => {});
    loadOverview();
  }, [loadOverview]);

  useEffect(() => { loadPlan(selectedId); }, [selectedId, loadPlan]);

  // Live: any agent/goal/approval event refreshes overview + the open plan.
  useEventStream(["agent", "goal", "safety"], (evt: SseEvent) => {
    void evt;
    if (reload.current) clearTimeout(reload.current);
    reload.current = setTimeout(() => {
      loadOverview();
      if (selectedId) loadPlan(selectedId);
    }, 700);
  });

  const selectedGoal = goals.find((g) => g.id === selectedId);
  const refreshAll = () => { loadOverview(); if (selectedId) loadPlan(selectedId); };

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Orchestrator"
        eyebrow="Goal execution"
        subtitle={
          overview
            ? `${overview.goals.length} goal${overview.goals.length !== 1 ? "s" : ""} in execution · ` +
              `${overview.active_runs.length} worker${overview.active_runs.length !== 1 ? "s" : ""} active · ` +
              `${overview.pending_approvals} approval${overview.pending_approvals !== 1 ? "s" : ""} pending`
            : "Loading..."
        }
      />

      {/* Goals in execution — quick-select chips with progress */}
      {overview && overview.goals.length > 0 && (
        <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {overview.goals.map((g) => (
            <button
              key={g.goal_id}
              onClick={() => setSelectedId(g.goal_id)}
              className={`rounded-lg border bg-surface p-3 text-left transition-colors ${
                selectedId === g.goal_id ? "border-accent" : "border-border hover:border-border-soft"
              }`}
            >
              <p className="truncate text-xs font-medium text-foreground">{g.title}</p>
              <div className="mt-2">
                <ProgressBar value={g.progress} />
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted">
                {g.completed_tasks}/{g.total_tasks} done
                {g.active_tasks > 0 && ` · ${g.active_tasks} active`} · {g.plan_status}
              </p>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        {/* LEFT — goal selection + plan */}
        <div className="space-y-4 lg:col-span-3">
          <div className="rounded-lg border border-border bg-surface p-4">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">
              Goal
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="">Select a goal to execute…</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </div>

          {selectedId && (
            <PlanPanel
              goal={selectedGoal}
              plan={plan}
              loading={loadingPlan}
              onChanged={refreshAll}
            />
          )}
        </div>

        {/* RIGHT — command chat + approvals/updates */}
        <div className="space-y-4 lg:col-span-2">
          <ChatPanel goalId={selectedId} goalTitle={selectedGoal?.title} onActed={refreshAll} />
          <ApprovalsFeed />
        </div>
      </div>
    </div>
  );
}

// ── plan panel ──────────────────────────────────────────────────────────────

function PlanPanel({
  goal,
  plan,
  loading,
  onChanged,
}: {
  goal: Goal | undefined;
  plan: GoalPlan | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [guidance, setGuidance] = useState("");
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!goal) return null;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{goal.title}</h2>
          <div className="mt-2 w-48"><ProgressBar value={goal.progress} /></div>
        </div>
        {plan && (
          <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted">
            plan {plan.status}
          </span>
        )}
      </div>

      {loading && <p className="text-xs text-muted">Loading plan…</p>}

      {/* No plan yet → decompose */}
      {!loading && !plan && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            No execution plan yet. Tell the orchestrator how to approach it (optional), then break it
            into worker tasks.
          </p>
          <textarea
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            rows={2}
            placeholder="Optional guidance (e.g. focus on X first)…"
            className="w-full resize-y rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button
            disabled={busy}
            onClick={() => run(() => decomposeGoal(goal.id, guidance.trim() || undefined))}
            className="rounded bg-accent px-4 py-2 text-sm text-white hover:bg-accent/80 disabled:opacity-40"
          >
            {busy ? "Planning…" : "Break into tasks"}
          </button>
        </div>
      )}

      {/* Plan exists */}
      {!loading && plan && (
        <div className="space-y-3">
          {plan.rationale && (
            <p className="rounded border border-border bg-surface-2/40 p-2 text-xs text-muted">
              {plan.rationale}
            </p>
          )}

          <div className="space-y-2">
            {plan.tasks.map((t) => (
              <TaskRow key={t.id} task={t} planStatus={plan.status} onChanged={onChanged} />
            ))}
          </div>

          {/* Plan-level actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {plan.status === "proposed" && (
              <button
                disabled={busy}
                onClick={() => run(() => approvePlan(plan.id))}
                className="rounded bg-green-500/80 px-3 py-1.5 text-sm text-white hover:bg-green-500 disabled:opacity-40"
              >
                Approve plan
              </button>
            )}
            {(plan.status === "approved" || plan.status === "executing") &&
              plan.tasks.some((t) => t.status === "pending") && (
                <button
                  disabled={busy}
                  onClick={() => run(() => dispatchPlan(plan.id))}
                  className="rounded bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/80 disabled:opacity-40"
                >
                  Dispatch all workers
                </button>
              )}
            <button
              disabled={busy}
              onClick={() => run(() => decomposeGoal(plan.goal_id))}
              className="rounded border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground disabled:opacity-40"
            >
              Re-plan
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function TaskRow({
  task,
  planStatus,
  onChanged,
}: {
  task: GoalTask;
  planStatus: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const canDispatch =
    task.status === "pending" && (planStatus === "approved" || planStatus === "executing");
  const live = task.status === "running" || task.status === "parked";

  const dispatch = async () => {
    setBusy(true);
    try { await dispatchTask(task.id); onChanged(); } finally { setBusy(false); }
  };

  return (
    <div className="rounded border border-border bg-surface-2/30 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-[10px] text-muted">
          {task.seq + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">{task.title}</span>
            <TaskChip status={task.status} />
          </div>
          <p className="mt-0.5 text-xs text-muted">{task.task}</p>

          {(live || expanded) && task.run_id && (
            <div className="mt-2 rounded border border-border bg-surface/60 p-2">
              <JobActivity runId={task.run_id} onTerminal={() => onChanged()} />
            </div>
          )}

          {task.status === "completed" && task.result_summary && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-1 text-[11px] text-accent hover:underline"
            >
              show result
            </button>
          )}
          {expanded && task.result_summary && (
            <p className="mt-2 whitespace-pre-wrap rounded border border-border bg-surface/60 p-2 text-xs text-foreground">
              {task.result_summary}
            </p>
          )}
        </div>

        {canDispatch && (
          <button
            disabled={busy}
            onClick={dispatch}
            className="shrink-0 rounded border border-border px-2 py-0.5 text-[11px] text-foreground hover:bg-surface-2 disabled:opacity-40"
          >
            {busy ? "…" : "Dispatch"}
          </button>
        )}
        {task.run_id && !live && (
          <Link
            href={`/runs/${task.run_id}`}
            className="shrink-0 text-[11px] text-muted hover:text-accent"
          >
            run &#8250;
          </Link>
        )}
      </div>
    </div>
  );
}

// ── command chat ──────────────────────────────────────────────────────────────

function ChatPanel({
  goalId,
  goalTitle,
  onActed,
}: {
  goalId: string;
  goalTitle?: string;
  onActed: () => void;
}) {
  const [messages, setMessages] = useState<OrchestratorMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    getOrchestratorMessages(goalId || undefined)
      .then((d) => setMessages(d.items))
      .catch(() => {});
  }, [goalId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setSending(true);
    // optimistic echo
    setMessages((m) => [
      ...m,
      { id: `tmp-${m.length}`, role: "user", content: msg, meta: {}, created_at: null },
    ]);
    setInput("");
    try {
      await orchestratorChat(msg, goalId || undefined);
      load();
      onActed();
    } catch {
      setMessages((m) => [
        ...m,
        { id: `err-${m.length}`, role: "orchestrator", content: "Sorry — that failed. Try again.", meta: {}, created_at: null },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[420px] flex-col rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-2">
        <p className="text-xs font-semibold text-foreground">Command the orchestrator</p>
        <p className="text-[10px] text-muted">
          {goalTitle ? `Scoped to: ${goalTitle}` : "Select a goal to scope commands"}
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="px-1 text-xs text-muted">
            Try: &ldquo;break this down&rdquo;, &ldquo;approve&rdquo;, &ldquo;start the workers&rdquo;,
            or &ldquo;how&rsquo;s it going?&rdquo;
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
              m.role === "user"
                ? "ml-auto bg-accent/15 text-foreground"
                : "bg-surface-2 text-foreground"
            }`}
          >
            {m.content}
            {typeof m.meta?.action === "string" && m.meta.action !== "none" && (
              <span className="mt-1 block font-mono text-[9px] text-muted">→ {m.meta.action}</span>
            )}
          </div>
        ))}
        {sending && <p className="px-1 text-[10px] text-muted">orchestrator is thinking…</p>}
      </div>

      <div className="flex gap-2 border-t border-border p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Tell the orchestrator what to do…"
          className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="rounded bg-accent px-3 py-2 text-sm text-white hover:bg-accent/80 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ── approvals + updates feed ───────────────────────────────────────────────────

function ApprovalsFeed() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [updates, setUpdates] = useState<{ id: string; text: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getPendingApprovals().then((d) => setApprovals(d.items)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  useEventStream(["agent", "goal", "safety"], (evt: SseEvent) => {
    if (evt.type.includes("approval")) load();
    const label = describeEvent(evt);
    if (label) {
      setUpdates((u) => [{ id: `${evt.seq}`, text: label }, ...u].slice(0, 12));
    }
  });

  const decide = async (apvId: string, kind: "grant" | "deny") => {
    setBusy(apvId);
    try {
      if (kind === "grant") await grantApproval(apvId);
      else await denyApproval(apvId, "denied from orchestrator");
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-2">
        <p className="text-xs font-semibold text-foreground">
          Approvals &amp; updates
          {approvals.length > 0 && (
            <span className="ml-2 rounded-full bg-yellow-400/20 px-1.5 py-0.5 text-[10px] text-yellow-400">
              {approvals.length} pending
            </span>
          )}
        </p>
      </div>

      <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
        {approvals.map((a) => (
          <div key={a.apv_id} className="rounded border border-yellow-400/30 bg-yellow-400/5 p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-yellow-400">
                Approval
              </span>
              <span className="font-mono text-[10px] text-muted">{a.action_class}</span>
              {a.payload?.tool && (
                <span className="font-mono text-[10px] text-muted">· {a.payload.tool}</span>
              )}
            </div>
            {a.payload?.why && <p className="mt-1 text-xs text-foreground">{a.payload.why}</p>}
            <div className="mt-2 flex items-center gap-2">
              <button
                disabled={busy === a.apv_id}
                onClick={() => decide(a.apv_id, "grant")}
                className="rounded bg-green-500/80 px-2.5 py-1 text-xs text-white hover:bg-green-500 disabled:opacity-40"
              >
                Grant
              </button>
              <button
                disabled={busy === a.apv_id}
                onClick={() => decide(a.apv_id, "deny")}
                className="rounded border border-red-400/40 px-2.5 py-1 text-xs text-red-400 hover:bg-red-400/10 disabled:opacity-40"
              >
                Deny
              </button>
              {a.run_id && (
                <Link href={`/runs/${a.run_id}`} className="text-[11px] text-muted hover:text-accent">
                  run &#8250;
                </Link>
              )}
            </div>
          </div>
        ))}

        {approvals.length === 0 && updates.length === 0 && (
          <p className="px-1 text-xs text-muted">No pending approvals. Live updates appear here.</p>
        )}

        {updates.length > 0 && (
          <div className="space-y-1 pt-1">
            {updates.map((u) => (
              <p key={u.id} className="border-l-2 border-border pl-2 text-[11px] text-muted">
                {u.text}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Turn an SSE event into a short human update line (best-effort).
function describeEvent(evt: SseEvent): string | null {
  const t = evt.type;
  const d = (evt.data ?? {}) as Record<string, unknown>;
  if (t.endsWith("goal.plan.proposed")) return `Plan proposed (${d.tasks ?? "?"} tasks)`;
  if (t.endsWith("goal.plan.approved")) return "Plan approved";
  if (t.endsWith("goal.task.dispatched")) return "Worker dispatched";
  if (t.endsWith("goal.progress")) return `Goal progress: ${Math.round(Number(d.progress ?? 0) * 100)}%`;
  if (t.endsWith("agent.run.completed")) return "A worker finished";
  if (t.endsWith("agent.run.failed")) return "A worker failed";
  if (t.includes("approval.requested")) return "Approval requested";
  if (t.includes("approval.granted")) return "Approval granted";
  return null;
}
