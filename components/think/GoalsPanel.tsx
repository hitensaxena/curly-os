"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeading } from "@/components/ui/PageHeading";
import {
  createGoal,
  getGoal,
  getGoals,
  invalidateGoal,
  patchGoal,
} from "@/lib/curlyos";
import type {
  CreateGoalBody,
  Goal,
  GoalDetail,
  GoalHorizon,
  GoalStatus,
} from "@/lib/curlyos-types";

// ── chips ─────────────────────────────────────────────────────────────────────

function HorizonChip({ horizon }: { horizon: GoalHorizon }) {
  if (!horizon) return null;
  const colors: Record<string, string> = {
    life: "text-purple-400 bg-purple-400/10 border-purple-400/30",
    year: "text-blue-400 bg-blue-400/10 border-blue-400/30",
    quarter: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
    month: "text-teal-400 bg-teal-400/10 border-teal-400/30",
  };
  const cls = colors[horizon] ?? "text-muted bg-surface-2 border-border";
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono ${cls}`}
    >
      {horizon}
    </span>
  );
}

function StatusChip({ status }: { status: GoalStatus }) {
  const colors: Record<GoalStatus, string> = {
    active: "text-green-400 bg-green-400/10 border-green-400/30",
    paused: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    achieved: "text-accent bg-accent/10 border-accent/30",
    abandoned: "text-muted bg-surface-2 border-border",
  };
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono ${colors[status]}`}
    >
      {status}
    </span>
  );
}

function ReflectionStatusBadge({
  status,
}: {
  status: string;
}) {
  const colors: Record<string, string> = {
    active: "text-green-400",
    stale: "text-yellow-400",
    on_track: "text-accent",
    blocked: "text-red-400",
    completed: "text-muted",
  };
  return (
    <span className={`text-[10px] font-mono ${colors[status] ?? "text-muted"}`}>
      {status}
    </span>
  );
}

// ── progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted tabular-nums w-7 text-right">
        {pct}%
      </span>
    </div>
  );
}

// ── new goal form ─────────────────────────────────────────────────────────────

interface NewGoalFormProps {
  topLevelGoals: Goal[];
  onSave: () => void;
  onCancel: () => void;
}

function NewGoalForm({ topLevelGoals, onSave, onCancel }: NewGoalFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [horizon, setHorizon] = useState<GoalHorizon>(null);
  const [successCriteria, setSuccessCriteria] = useState("");
  const [parentId, setParentId] = useState("");
  const [priority, setPriority] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const save = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body: CreateGoalBody = { title: title.trim() };
      if (description.trim()) body.description = description.trim();
      if (horizon) body.horizon = horizon;
      if (successCriteria.trim()) body.success_criteria = successCriteria.trim();
      if (parentId) body.parent_id = parentId;
      if (priority.trim()) body.priority = parseInt(priority, 10);
      await createGoal(body);
      onSave();
    } catch {
      setError("Failed to create goal.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4 mb-5">
      <p className="text-xs text-muted mb-3 font-semibold uppercase tracking-wide">
        New Goal
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Title (required)"
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <select
          value={horizon ?? ""}
          onChange={(e) =>
            setHorizon((e.target.value as GoalHorizon) || null)
          }
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
        >
          <option value="">Horizon (optional)</option>
          <option value="life">Life</option>
          <option value="year">Year</option>
          <option value="quarter">Quarter</option>
          <option value="month">Month</option>
        </select>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <input
          value={successCriteria}
          onChange={(e) => setSuccessCriteria(e.target.value)}
          placeholder="Success criteria (optional)"
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
        >
          <option value="">No parent (top-level)</option>
          {topLevelGoals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          placeholder="Priority (optional number)"
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        />
      </div>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="rounded bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/80 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Create"}
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-border px-4 py-1.5 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── progress editor ───────────────────────────────────────────────────────────

interface ProgressEditorProps {
  goalId: string;
  current: number;
  onDone: () => void;
}

function ProgressEditor({ goalId, current, onDone }: ProgressEditorProps) {
  const [val, setVal] = useState(Math.round(current * 100));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await patchGoal(goalId, { progress: val / 100 });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        type="range"
        min={0}
        max={100}
        value={val}
        onChange={(e) => setVal(parseInt(e.target.value, 10))}
        className="flex-1"
      />
      <span className="text-xs text-muted w-8 tabular-nums">{val}%</span>
      <button
        onClick={save}
        disabled={saving}
        className="rounded bg-accent px-2 py-0.5 text-xs text-white hover:bg-accent/80 disabled:opacity-40"
      >
        {saving ? "..." : "Set"}
      </button>
      <button
        onClick={onDone}
        className="text-xs text-muted hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}

// ── invalidate prompt ─────────────────────────────────────────────────────────

interface InvalidatePromptProps {
  goalId: string;
  onDone: () => void;
}

function InvalidatePrompt({ goalId, onDone }: InvalidatePromptProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await invalidateGoal(goalId, reason.trim());
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="Reason for invalidating"
        autoFocus
        className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
      />
      <button
        onClick={save}
        disabled={saving || !reason.trim()}
        className="rounded bg-red-500/80 px-2 py-0.5 text-xs text-white hover:bg-red-500 disabled:opacity-40"
      >
        {saving ? "..." : "Confirm"}
      </button>
      <button
        onClick={onDone}
        className="text-xs text-muted hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}

// ── goal detail panel ─────────────────────────────────────────────────────────

interface GoalDetailPanelProps {
  goalId: string;
  onClose: () => void;
}

function GoalDetailPanel({ goalId, onClose }: GoalDetailPanelProps) {
  const [detail, setDetail] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getGoal(goalId)
      .then((d) => { if (mounted) { setDetail(d); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [goalId]);

  return (
    <div className="rounded-lg border border-border bg-surface p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Details
        </p>
        <button
          onClick={onClose}
          className="text-xs text-muted hover:text-foreground"
        >
          &#x2715;
        </button>
      </div>
      {loading && (
        <p className="text-xs text-muted">Loading...</p>
      )}
      {!loading && !detail && (
        <p className="text-xs text-muted">Failed to load details.</p>
      )}
      {detail && (
        <div className="space-y-4">
          {detail.description && (
            <p className="text-sm text-muted">{detail.description}</p>
          )}
          {detail.success_criteria && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                Success Criteria
              </p>
              <p className="text-sm text-foreground">{detail.success_criteria}</p>
            </div>
          )}
          {detail.children.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                Sub-goals ({detail.children.length})
              </p>
              <div className="divide-y divide-border rounded border border-border">
                {detail.children.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2">
                    <p className="flex-1 text-sm text-foreground truncate">{c.title}</p>
                    <StatusChip status={c.status} />
                    <span className="text-[10px] text-muted tabular-nums w-8 text-right">
                      {Math.round(c.progress * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {detail.decisions.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                Linked Decisions ({detail.decisions.length})
              </p>
              <div className="divide-y divide-border rounded border border-border">
                {detail.decisions.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-3 py-2">
                    <p className="flex-1 text-sm text-foreground truncate">{d.title}</p>
                    <a
                      href="/decisions"
                      className="text-[10px] text-accent hover:underline"
                    >
                      /decisions
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── goal row ──────────────────────────────────────────────────────────────────

type GoalAction =
  | { type: "progress"; goalId: string }
  | { type: "invalidate"; goalId: string }
  | { type: "detail"; goalId: string };

interface GoalRowProps {
  goal: Goal;
  indent?: boolean;
  activeAction: GoalAction | null;
  setActiveAction: (a: GoalAction | null) => void;
  reload: () => void;
}

function GoalRow({
  goal,
  indent = false,
  activeAction,
  setActiveAction,
  reload,
}: GoalRowProps) {
  const reflection = goal.properties.last_reflection;

  const isProgressOpen =
    activeAction?.type === "progress" && activeAction.goalId === goal.id;
  const isInvalidateOpen =
    activeAction?.type === "invalidate" && activeAction.goalId === goal.id;
  const isDetailOpen =
    activeAction?.type === "detail" && activeAction.goalId === goal.id;

  const handleStatus = async (status: GoalStatus) => {
    await patchGoal(goal.id, { status });
    reload();
  };

  return (
    <div
      className={`px-4 py-3 ${indent ? "pl-8 border-l-2 border-accent/20" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() =>
                setActiveAction(
                  isDetailOpen ? null : { type: "detail", goalId: goal.id }
                )
              }
              className="text-sm font-medium text-foreground hover:text-accent text-left truncate"
            >
              {goal.title}
            </button>
            <HorizonChip horizon={goal.horizon} />
            <StatusChip status={goal.status} />
            {goal.priority !== null && (
              <span className="text-[10px] font-mono text-muted">
                p{goal.priority}
              </span>
            )}
          </div>

          {reflection && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <ReflectionStatusBadge status={reflection.status} />
              {reflection.detail && (
                <span className="text-[10px] text-muted truncate max-w-xs">
                  {reflection.detail}
                </span>
              )}
            </div>
          )}

          <div className="mt-1.5 max-w-sm">
            <ProgressBar value={goal.progress} />
          </div>

          {/* inline editors */}
          {isProgressOpen && (
            <ProgressEditor
              goalId={goal.id}
              current={goal.progress}
              onDone={() => { setActiveAction(null); reload(); }}
            />
          )}
          {isInvalidateOpen && (
            <InvalidatePrompt
              goalId={goal.id}
              onDone={() => { setActiveAction(null); reload(); }}
            />
          )}
        </div>

        {/* action buttons */}
        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          {goal.status === "active" && (
            <button
              onClick={() => handleStatus("achieved")}
              className="rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:text-green-400 hover:border-green-400/40"
            >
              achieved
            </button>
          )}
          {goal.status === "active" && (
            <button
              onClick={() => handleStatus("paused")}
              className="rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:text-yellow-400 hover:border-yellow-400/40"
            >
              pause
            </button>
          )}
          {goal.status === "paused" && (
            <button
              onClick={() => handleStatus("active")}
              className="rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:text-green-400 hover:border-green-400/40"
            >
              resume
            </button>
          )}
          <button
            onClick={() =>
              setActiveAction(
                isProgressOpen ? null : { type: "progress", goalId: goal.id }
              )
            }
            className="rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:text-accent hover:border-accent/40"
          >
            progress
          </button>
          <button
            onClick={() =>
              setActiveAction(
                isInvalidateOpen
                  ? null
                  : { type: "invalidate", goalId: goal.id }
              )
            }
            className="rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:text-red-400 hover:border-red-400/40"
          >
            invalidate
          </button>
        </div>
      </div>

      {isDetailOpen && (
        <GoalDetailPanel
          goalId={goal.id}
          onClose={() => setActiveAction(null)}
        />
      )}
    </div>
  );
}

// ── goal tree ─────────────────────────────────────────────────────────────────

interface GoalTreeProps {
  goals: Goal[];
  activeAction: GoalAction | null;
  setActiveAction: (a: GoalAction | null) => void;
  reload: () => void;
}

function GoalTree({ goals, activeAction, setActiveAction, reload }: GoalTreeProps) {
  const topLevel = goals.filter((g) => g.parent_id === null);
  const childMap = new Map<string, Goal[]>();
  for (const g of goals) {
    if (g.parent_id) {
      const list = childMap.get(g.parent_id) ?? [];
      list.push(g);
      childMap.set(g.parent_id, list);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface divide-y divide-border">
      {topLevel.map((g) => (
        <div key={g.id}>
          <GoalRow
            goal={g}
            activeAction={activeAction}
            setActiveAction={setActiveAction}
            reload={reload}
          />
          {(childMap.get(g.id) ?? []).map((child) => (
            <div key={child.id} className="border-t border-border/50 bg-surface-2/30">
              <GoalRow
                goal={child}
                indent
                activeAction={activeAction}
                setActiveAction={setActiveAction}
                reload={reload}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [activeAction, setActiveAction] = useState<GoalAction | null>(null);
  const [statusFilter, setStatusFilter] = useState("active");

  const load = () => {
    setLoading(true);
    getGoals(statusFilter || undefined)
      .then((d) => { setGoals(d.items); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const topLevelGoals = goals.filter((g) => g.parent_id === null);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Goals"
        subtitle={
          loading
            ? "Loading..."
            : goals.length === 0
            ? "No goals yet"
            : `${goals.length} goal${goals.length !== 1 ? "s" : ""}`
        }
        eyebrow="Goal OS"
        actions={
          !loading ? (
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="achieved">Achieved</option>
                <option value="abandoned">Abandoned</option>
              </select>
              <button
                onClick={() => setShowNew((v) => !v)}
                className="rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20"
              >
                + New goal
              </button>
            </div>
          ) : undefined
        }
      />

      {showNew && (
        <NewGoalForm
          topLevelGoals={topLevelGoals}
          onSave={() => { setShowNew(false); load(); }}
          onCancel={() => setShowNew(false)}
        />
      )}

      {loading && (
        <div className="flex items-center justify-center h-40 text-muted text-sm">
          Loading...
        </div>
      )}

      {!loading && goals.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <div className="text-4xl mb-3">&#9670;</div>
          <h2 className="text-base font-semibold text-foreground mb-1">
            No goals yet
          </h2>
          <p className="text-sm text-muted mb-6 max-w-sm mx-auto">
            Goals are structured intentions tied to your life horizons. Create
            your first goal to get started.
          </p>
          {!showNew && (
            <button
              onClick={() => setShowNew(true)}
              className="rounded-lg border border-accent bg-accent/10 px-5 py-2.5 text-sm text-accent hover:bg-accent/20"
            >
              + New goal
            </button>
          )}
        </div>
      )}

      {!loading && goals.length > 0 && (
        <GoalTree
          goals={goals}
          activeAction={activeAction}
          setActiveAction={setActiveAction}
          reload={load}
        />
      )}
    </div>
  );
}
