"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeading } from "@/components/ui/PageHeading";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createDecision,
  getDecisionsWithCouncil,
  getGoals,
  reviewDecision,
  runCouncil,
} from "@/lib/curlyos";
import type {
  CouncilPerspective,
  CouncilResult,
  CreateDecisionBody,
  DecisionReversibility,
  DecisionWithCouncil,
  Goal,
} from "@/lib/curlyos-types";

// ── reversibility chip ────────────────────────────────────────────────────────

function ReversibilityChip({
  value,
}: {
  value: DecisionReversibility;
}) {
  if (!value) return null;
  const colors: Record<string, string> = {
    reversible: "text-green-400 bg-green-400/10 border-green-400/30",
    costly: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    one_way: "text-red-400 bg-red-400/10 border-red-400/30",
  };
  const cls = colors[value] ?? "text-muted bg-surface-2 border-border";
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono ${cls}`}
    >
      {value.replace("_", "-")}
    </span>
  );
}

// ── record decision form ──────────────────────────────────────────────────────

interface NewDecisionFormProps {
  goals: Goal[];
  onSave: () => void;
  onCancel: () => void;
}

function NewDecisionForm({ goals, onSave, onCancel }: NewDecisionFormProps) {
  const [title, setTitle] = useState("");
  const [chosen, setChosen] = useState("");
  const [rationale, setRationale] = useState("");
  const [context, setContext] = useState("");
  const [reversibility, setReversibility] = useState<DecisionReversibility>(null);
  const [goalId, setGoalId] = useState("");
  const defaultReviewAt = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  };
  const [reviewAt, setReviewAt] = useState(defaultReviewAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const save = async () => {
    if (!title.trim() || !chosen.trim() || !rationale.trim()) {
      setError("Title, chosen, and rationale are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body: CreateDecisionBody = {
        title: title.trim(),
        chosen: chosen.trim(),
        rationale: rationale.trim(),
      };
      if (context.trim()) body.context = context.trim();
      if (reversibility) body.reversibility = reversibility;
      if (goalId) body.goal_id = goalId;
      if (reviewAt) body.review_at = new Date(reviewAt).toISOString();
      await createDecision(body);
      onSave();
    } catch {
      setError("Failed to create decision.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4 mb-6">
      <p className="text-xs text-muted mb-3 font-semibold uppercase tracking-wide">
        Record Decision
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (required)"
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <input
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
          placeholder="Chosen option (required)"
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Rationale (required)"
          rows={2}
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent sm:col-span-2 resize-none"
        />
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Context (optional)"
          rows={2}
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent sm:col-span-2 resize-none"
        />
        <select
          value={reversibility ?? ""}
          onChange={(e) =>
            setReversibility((e.target.value as DecisionReversibility) || null)
          }
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
        >
          <option value="">Reversibility (optional)</option>
          <option value="reversible">Reversible</option>
          <option value="costly">Costly to reverse</option>
          <option value="one_way">One-way door</option>
        </select>
        <select
          value={goalId}
          onChange={(e) => setGoalId(e.target.value)}
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
        >
          <option value="">No linked goal</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted shrink-0">Review at</label>
          <input
            type="date"
            value={reviewAt}
            onChange={(e) => setReviewAt(e.target.value)}
            className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !title.trim() || !chosen.trim() || !rationale.trim()}
          className="rounded bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/80 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Record"}
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

// ── outcome form ──────────────────────────────────────────────────────────────

interface OutcomeFormProps {
  decision: DecisionWithCouncil;
  onDone: () => void;
}

function OutcomeForm({ decision, onDone }: OutcomeFormProps) {
  const [outcome, setOutcome] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!outcome.trim()) return;
    setSaving(true);
    try {
      await reviewDecision(decision.id, outcome.trim());
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        placeholder="Describe the actual outcome..."
        rows={2}
        className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !outcome.trim()}
          className="rounded bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent/80 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Record outcome"}
        </button>
        <button
          onClick={onDone}
          className="rounded border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── council report ────────────────────────────────────────────────────────────

const PERSPECTIVE_COLORS: Record<string, string> = {
  skeptic: "text-red-400 border-red-400/30 bg-red-400/5",
  champion: "text-green-400 border-green-400/30 bg-green-400/5",
  operator: "text-blue-400 border-blue-400/30 bg-blue-400/5",
  outsider: "text-purple-400 border-purple-400/30 bg-purple-400/5",
};

function PerspectiveBlock({ p }: { p: CouncilPerspective }) {
  const [open, setOpen] = useState(false);
  const key = p.perspective.toLowerCase();
  const cls = PERSPECTIVE_COLORS[key] ?? "text-muted border-border bg-surface-2/30";
  return (
    <div className={`rounded border ${cls} overflow-hidden`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {p.perspective}
        </span>
        <span className="text-[10px] text-muted">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <p className="text-xs text-muted leading-relaxed">{p.view}</p>
        </div>
      )}
    </div>
  );
}

interface CouncilReportProps {
  council: CouncilResult;
  defaultOpen?: boolean;
}

function CouncilReport({ council, defaultOpen = false }: CouncilReportProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-2/20 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-surface-2/40"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Council report
        </span>
        <span className="text-[10px] text-muted">{open ? "Hide" : "Show council"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {council.perspectives.map((p) => (
              <PerspectiveBlock key={p.perspective} p={p} />
            ))}
          </div>
          {council.synthesis && (
            <div className="rounded border border-accent/30 bg-accent/5 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-accent mb-1">
                Synthesis
              </p>
              <p className="text-xs text-foreground leading-relaxed">
                {council.synthesis}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── decision card ─────────────────────────────────────────────────────────────

interface DecisionCardProps {
  decision: DecisionWithCouncil;
  showOutcomeForm: boolean;
  onToggleOutcome: () => void;
  onOutcomeSaved: () => void;
}

function DecisionCard({
  decision,
  showOutcomeForm,
  onToggleOutcome,
  onOutcomeSaved,
}: DecisionCardProps) {
  const toast = useToast();
  const [councilBusy, setCouncilBusy] = useState(false);
  const [localCouncil, setLocalCouncil] = useState<CouncilResult | null>(null);

  const existingCouncil = decision.properties?.council ?? localCouncil;

  const handleRunCouncil = async () => {
    setCouncilBusy(true);
    try {
      const result = await runCouncil(decision.id);
      setLocalCouncil(result);
      toast.success("Council report ready.");
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 503) {
        toast.error("LLM unavailable — try again shortly.");
      } else {
        toast.error("Council failed.");
      }
    } finally {
      setCouncilBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground">{decision.title}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <ReversibilityChip value={decision.reversibility} />
            {decision.goal_id && (
              <a
                href="/goals"
                className="text-[10px] text-accent hover:underline font-mono"
              >
                linked goal
              </a>
            )}
            <span className="text-[10px] text-muted font-mono">
              {new Date(decision.decided_at).toLocaleDateString()}
            </span>
            {decision.review_at && (
              <span className="text-[10px] text-muted font-mono">
                review {new Date(decision.review_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          {!decision.outcome && (
            <button
              onClick={onToggleOutcome}
              className="rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:text-accent hover:border-accent/40"
            >
              record outcome
            </button>
          )}
          {!existingCouncil && (
            <button
              onClick={handleRunCouncil}
              disabled={councilBusy}
              className="rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:text-purple-400 hover:border-purple-400/40 disabled:opacity-40 flex items-center gap-1"
            >
              {councilBusy && (
                <span className="inline-block w-2.5 h-2.5 rounded-full border border-purple-400/40 border-t-purple-400 animate-spin" />
              )}
              {councilBusy ? "Consulting..." : "Council"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 space-y-1">
        <div className="flex gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted w-16 shrink-0">
            Chosen
          </span>
          <span className="text-xs text-foreground">{decision.chosen}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted w-16 shrink-0">
            Rationale
          </span>
          <span className="text-xs text-muted">{decision.rationale}</span>
        </div>
        {decision.context && (
          <div className="flex gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted w-16 shrink-0">
              Context
            </span>
            <span className="text-xs text-muted">{decision.context}</span>
          </div>
        )}
        {decision.outcome && (
          <div className="flex gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted w-16 shrink-0">
              Outcome
            </span>
            <span className="text-xs text-accent">{decision.outcome}</span>
          </div>
        )}
      </div>

      {showOutcomeForm && (
        <OutcomeForm
          decision={decision}
          onDone={onOutcomeSaved}
        />
      )}

      {existingCouncil && (
        <CouncilReport
          council={existingCouncil}
          defaultOpen={localCouncil !== null}
        />
      )}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function DecisionsPage() {
  const [dueDecisions, setDueDecisions] = useState<DecisionWithCouncil[]>([]);
  const [allDecisions, setAllDecisions] = useState<DecisionWithCouncil[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [outcomeOpenId, setOutcomeOpenId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      getDecisionsWithCouncil(true).catch(() => ({ items: [] as DecisionWithCouncil[], count: 0 })),
      getDecisionsWithCouncil(false).catch(() => ({ items: [] as DecisionWithCouncil[], count: 0 })),
      getGoals().catch(() => ({ items: [] as Goal[], count: 0 })),
    ]).then(([due, all, gs]) => {
      setDueDecisions(due.items);
      setAllDecisions(all.items);
      setGoals(gs.items);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Decisions"
        subtitle={
          loading
            ? "Loading..."
            : `${allDecisions.length} decision${allDecisions.length !== 1 ? "s" : ""}${
                dueDecisions.length > 0
                  ? ` · ${dueDecisions.length} due for review`
                  : ""
              }`
        }
        eyebrow="Goal OS"
        actions={
          !loading ? (
            <button
              onClick={() => setShowNew((v) => !v)}
              className="rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20"
            >
              + Record decision
            </button>
          ) : undefined
        }
      />

      {showNew && (
        <NewDecisionForm
          goals={goals}
          onSave={() => { setShowNew(false); load(); }}
          onCancel={() => setShowNew(false)}
        />
      )}

      {loading && (
        <div className="flex items-center justify-center h-40 text-muted text-sm">
          Loading...
        </div>
      )}

      {!loading && dueDecisions.length === 0 && allDecisions.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <div className="text-4xl mb-3">&#9670;</div>
          <h2 className="text-base font-semibold text-foreground mb-1">
            No decisions yet
          </h2>
          <p className="text-sm text-muted mb-6 max-w-sm mx-auto">
            Record significant decisions so you can review outcomes and learn
            from them.
          </p>
          {!showNew && (
            <button
              onClick={() => setShowNew(true)}
              className="rounded-lg border border-accent bg-accent/10 px-5 py-2.5 text-sm text-accent hover:bg-accent/20"
            >
              + Record decision
            </button>
          )}
        </div>
      )}

      {!loading && dueDecisions.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-yellow-400 mb-3">
            Due for review ({dueDecisions.length})
          </h2>
          <div className="space-y-3">
            {dueDecisions.map((d) => (
              <DecisionCard
                key={d.id}
                decision={d}
                showOutcomeForm={outcomeOpenId === d.id}
                onToggleOutcome={() =>
                  setOutcomeOpenId((prev) => (prev === d.id ? null : d.id))
                }
                onOutcomeSaved={() => { setOutcomeOpenId(null); load(); }}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && allDecisions.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
            All decisions ({allDecisions.length})
          </h2>
          <div className="space-y-3">
            {[...allDecisions]
              .sort(
                (a, b) =>
                  new Date(b.decided_at).getTime() -
                  new Date(a.decided_at).getTime(),
              )
              .map((d) => (
                <DecisionCard
                  key={d.id}
                  decision={d}
                  showOutcomeForm={outcomeOpenId === d.id}
                  onToggleOutcome={() =>
                    setOutcomeOpenId((prev) => (prev === d.id ? null : d.id))
                  }
                  onOutcomeSaved={() => { setOutcomeOpenId(null); load(); }}
                />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
