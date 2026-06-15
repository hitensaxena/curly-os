"use client";

// The per-goal workspace: header + Conversation / Plan / Studio / Activity tabs.
// Shared by the global /orchestrator page and the in-project goal route so a goal
// shows the same chat, plan, agent runs, and deliverables wherever you open it.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { JobActivity } from "@/components/jobs/JobActivity";
import { ArtifactList } from "@/components/hierarchy/ArtifactList";
import { useEventStream } from "@/lib/use-event-stream";
import {
  getGoalPlan,
  getGoalArtifacts,
  getArtifacts,
  decomposeGoal,
  approvePlan,
  dispatchTask,
  executePlan,
  orchestratorChat,
  getOrchestratorMessages,
} from "@/lib/curlyos";
import type {
  GoalPlan,
  GoalTask,
  GoalTaskStatus,
  GoalArtifact,
  Artifact,
  OrchestratorMessage,
  SseEvent,
} from "@/lib/curlyos-types";

type Tab = "conversation" | "plan" | "studio" | "artifacts";

// ── shared bits ───────────────────────────────────────────────────────────────

export function ProgressBar({ value, thin }: { value: number; thin?: boolean }) {
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

function AttemptPill({ attempt, max }: { attempt: number; max: number }) {
  if (!attempt) return null;
  return (
    <span className="inline-flex items-center rounded border border-orange-400/30 bg-orange-400/10 px-1.5 py-0.5 text-[10px] font-mono text-orange-400">
      ⟳ attempt {attempt + 1}/{max + 1}
    </span>
  );
}

export function planBadge(status: string): { label: string; cls: string } {
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

// ── the goal workspace ─────────────────────────────────────────────────────────

export function GoalWorkspace({
  goalId, title, progress, onChanged,
}: {
  goalId: string;
  title: string;
  progress: number;
  onChanged?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("conversation");
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

  useEventStream(["agent", "goal"], (_evt: SseEvent) => {
    if (reload.current) clearTimeout(reload.current);
    reload.current = setTimeout(() => { loadPlan(); loadArtifacts(); loadStudio(); onChanged?.(); }, 800);
  });

  const refresh = () => { loadPlan(); loadArtifacts(); loadStudio(); onChanged?.(); };
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
      <div className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <div className="mt-2 w-56"><ProgressBar value={progress} /></div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {plan && <span className={`rounded border px-1.5 py-0.5 text-[10px] font-mono ${b.cls}`}>{b.label}</span>}
            {plan?.status === "proposed" && (
              <button disabled={busy} onClick={() => act(() => executePlan(plan.id))}
                className="rounded bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent/80 disabled:opacity-40">
                Execute plan
              </button>
            )}
            {!plan && (
              <button disabled={busy} onClick={() => act(() => decomposeGoal(goalId))}
                className="rounded bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent/80 disabled:opacity-40">
                {busy ? "Planning…" : "Plan this goal"}
              </button>
            )}
            {plan && (
              <button disabled={busy} onClick={() => act(() => decomposeGoal(goalId))}
                className="rounded border border-border px-2.5 py-1.5 text-xs text-muted hover:text-foreground disabled:opacity-40">
                Re-plan
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex gap-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1.5 text-xs transition-colors ${
                tab === t.id ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              }`}>
              {t.label}{typeof t.n === "number" && t.n > 0 ? ` (${t.n})` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {tab === "conversation" && (
          <ConversationTab goalId={goalId} plan={plan} artifacts={artifacts} busy={busy} act={act} />
        )}
        {tab === "plan" && <PlanTab plan={plan} onChanged={refresh} />}
        {tab === "studio" && (
          <ArtifactList artifacts={studio}
            emptyHint="No deliverables yet. As workers write files and make things for this goal, they land here." />
        )}
        {tab === "artifacts" && <ActivityList artifacts={artifacts} />}
      </div>
    </div>
  );
}

// ── conversation tab ────────────────────────────────────────────────────────────

type FeedItem =
  | { kind: "msg"; at: number; m: OrchestratorMessage }
  | { kind: "artifact"; at: number; a: GoalArtifact };

function ConversationTab({
  goalId, plan, artifacts, busy, act,
}: {
  goalId: string;
  plan: GoalPlan | null;
  artifacts: GoalArtifact[];
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
    try { await orchestratorChat(msg, goalId); load(); }
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

      {plan?.status === "proposed" && (
        <div className="my-2 rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-3">
          <p className="text-xs font-semibold text-foreground">Proposed plan — {plan.tasks.length} tasks</p>
          {plan.rationale && <p className="mt-0.5 text-[11px] text-muted">{plan.rationale}</p>}
          <ol className="mt-1.5 space-y-0.5">
            {plan.tasks.map((t) => (
              <li key={t.id} className="text-[11px] text-muted">{t.seq + 1}. {t.title}</li>
            ))}
          </ol>
          <button disabled={busy} onClick={() => act(() => executePlan(plan.id))}
            className="mt-2 rounded bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent/80 disabled:opacity-40">
            Execute plan
          </button>
        </div>
      )}

      <div className="mt-2 flex gap-2 border-t border-border pt-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message the orchestrator about this goal…"
          className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none" />
        <button onClick={send} disabled={sending || !input.trim()}
          className="rounded bg-accent px-3 py-2 text-sm text-white hover:bg-accent/80 disabled:opacity-40">
          Send
        </button>
      </div>
    </div>
  );
}

// ── plan tab ────────────────────────────────────────────────────────────────────

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

// ── activity (legacy tool-output artifacts) ─────────────────────────────────────

function ActivityList({ artifacts }: { artifacts: GoalArtifact[] }) {
  if (artifacts.length === 0) return <p className="text-xs text-muted">No activity yet. Tool calls — memories, decisions, sketches, commits — appear here as workers run.</p>;
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
