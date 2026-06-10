"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/ui/PageHeading";
import { useToast } from "@/components/ui/ToastProvider";
import { executeSimRun } from "@/lib/curlyos";

const API = "";

interface SimScenarioOutcome {
  scenarios: Record<string, number>;
  implications: string;
}

interface SimRun {
  id: string;
  scope: string | null;
  question: string;
  world_model_id: string | null;
  status: string;
  epistemic_status: string;
  outcome_distribution: SimScenarioOutcome | Record<string, number> | unknown[] | null;
  parameters: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

function statusChip(status: string) {
  const map: Record<string, string> = {
    created: "text-blue-400 bg-blue-400/10 border-blue-400/30",
    running: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    completed: "text-green-400 bg-green-400/10 border-green-400/30",
    failed: "text-red-400 bg-red-400/10 border-red-400/30",
  };
  const cls = map[status] ?? "text-muted bg-surface-2 border-border";
  return (
    <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 ${cls}`}>
      {status}
    </span>
  );
}

function epistemicChip(es: string) {
  return (
    <span className="text-[10px] font-mono border border-purple-400/30 rounded px-1.5 py-0.5 text-purple-400 bg-purple-400/10">
      {es}
    </span>
  );
}

function ScenarioBars({ scenarios }: { scenarios: Record<string, number> }) {
  const entries = Object.entries(scenarios);
  if (entries.length === 0) {
    return <p className="text-xs text-muted italic">No outcomes computed yet.</p>;
  }
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="space-y-2">
      {entries.map(([label, value]) => {
        const pct = total > 0 ? (value / total) * 100 : 0;
        return (
          <div key={label}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-foreground font-mono">{label}</span>
              <span className="text-xs text-muted">{pct.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OutcomeDistribution({
  distribution,
}: {
  distribution: SimRun["outcome_distribution"];
}) {
  if (distribution === null || distribution === undefined) {
    return (
      <p className="text-xs text-muted italic">No outcomes computed yet.</p>
    );
  }

  // New shape from /execute: {scenarios: {...}, implications: string}
  if (
    !Array.isArray(distribution) &&
    typeof distribution === "object" &&
    "scenarios" in distribution &&
    typeof (distribution as SimScenarioOutcome).scenarios === "object"
  ) {
    const d = distribution as SimScenarioOutcome;
    return (
      <div className="space-y-3">
        <ScenarioBars scenarios={d.scenarios} />
        {d.implications && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
              Implications
            </p>
            <p className="text-xs text-muted leading-relaxed">{d.implications}</p>
          </div>
        )}
      </div>
    );
  }

  // Flat object mapping label -> number
  if (
    !Array.isArray(distribution) &&
    typeof distribution === "object" &&
    Object.values(distribution).every((v) => typeof v === "number")
  ) {
    return <ScenarioBars scenarios={distribution as Record<string, number>} />;
  }

  // Array or unknown shape — pretty-print
  return (
    <pre className="text-[11px] text-muted bg-surface-2 border border-border rounded p-2 overflow-x-auto whitespace-pre-wrap">
      {JSON.stringify(distribution, null, 2)}
    </pre>
  );
}

export default function SimulationPage() {
  const toast = useToast();
  const [runs, setRuns] = useState<SimRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<SimRun | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [paramsRaw, setParamsRaw] = useState("");
  const [paramsError, setParamsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadRuns = () => {
    setLoading(true);
    setError(null);
    fetch(`${API}/api/simulation/runs`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setRuns(d.items || []);
        setTotal(d.count ?? d.items?.length ?? 0);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message ?? "Failed to load runs.");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const validateParams = (raw: string): Record<string, unknown> | null => {
    if (!raw.trim()) return null;
    try {
      const parsed = JSON.parse(raw);
      setParamsError(null);
      return parsed as Record<string, unknown>;
    } catch {
      setParamsError("Invalid JSON — check your syntax.");
      return undefined as unknown as null;
    }
  };

  const handleParamsChange = (v: string) => {
    setParamsRaw(v);
    if (paramsError && !v.trim()) setParamsError(null);
  };

  const handleSubmit = async () => {
    if (!question.trim()) return;
    // Validate params before submit
    if (paramsRaw.trim()) {
      try {
        JSON.parse(paramsRaw);
      } catch {
        setParamsError("Invalid JSON — fix before submitting.");
        return;
      }
    }
    const params = paramsRaw.trim() ? JSON.parse(paramsRaw) : undefined;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body: Record<string, unknown> = { question: question.trim() };
      if (params !== undefined) body.parameters = params;
      const r = await fetch(`${API}/api/simulation/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setQuestion("");
      setParamsRaw("");
      setParamsError(null);
      setShowForm(false);
      loadRuns();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecute = async (runId: string) => {
    setExecutingId(runId);
    try {
      await executeSimRun(runId);
      toast.success("Simulation executed.");
      loadRuns();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        toast.error("Already completed.");
      } else if (status === 503) {
        toast.error("LLM unavailable — try again shortly.");
      } else {
        toast.error((err instanceof Error ? err.message : null) ?? "Execute failed.");
      }
    } finally {
      setExecutingId(null);
    }
  };

  const isEmpty = !loading && runs.length === 0 && !error;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <PageHeading
        eyebrow="Simulation"
        title="Possible Worlds"
        subtitle={!isEmpty ? `${total} simulation run${total !== 1 ? "s" : ""}` : undefined}
        actions={
          !isEmpty ? (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20"
            >
              + New run
            </button>
          ) : undefined
        }
      />

      {/* Inline create form (shown when list is populated and toggled) */}
      {!isEmpty && showForm && (
        <CreateForm
          question={question}
          paramsRaw={paramsRaw}
          paramsError={paramsError}
          submitError={submitError}
          submitting={submitting}
          onQuestionChange={setQuestion}
          onParamsChange={handleParamsChange}
          onParamsBlur={() => {
            if (paramsRaw.trim()) validateParams(paramsRaw);
          }}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setParamsError(null);
            setSubmitError(null);
          }}
        />
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted">Loading...</div>
      ) : isEmpty ? (
        /* === EMPTY STATE === */
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted mb-2 font-semibold text-foreground">
            No simulations yet
          </p>
          <p className="text-sm text-muted mb-6 max-w-md mx-auto">
            Simulation lets you pose a &ldquo;what if&rdquo; scenario and records it as a{" "}
            <em>possible world</em> with an outcome distribution to explore.
          </p>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20"
            >
              + New run
            </button>
          ) : (
            <div className="text-left max-w-lg mx-auto">
              <CreateForm
                question={question}
                paramsRaw={paramsRaw}
                paramsError={paramsError}
                submitError={submitError}
                submitting={submitting}
                onQuestionChange={setQuestion}
                onParamsChange={handleParamsChange}
                onParamsBlur={() => {
                  if (paramsRaw.trim()) validateParams(paramsRaw);
                }}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setShowForm(false);
                  setParamsError(null);
                  setSubmitError(null);
                }}
              />
            </div>
          )}
        </div>
      ) : (
        /* === MASTER-DETAIL === */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Master list */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-border bg-surface divide-y divide-border">
              {runs.map((run) => (
                <div
                  key={run.id}
                  onClick={() => setSelected(run)}
                  className={`px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer ${
                    selected?.id === run.id
                      ? "bg-surface-2 border-l-2 border-accent"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-foreground line-clamp-2 flex-1">
                      {run.question?.slice(0, 200)}
                    </p>
                    {run.status === "created" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExecute(run.id);
                        }}
                        disabled={executingId === run.id}
                        className="shrink-0 rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] text-accent hover:bg-accent/20 disabled:opacity-40 flex items-center gap-1"
                      >
                        {executingId === run.id && (
                          <span className="inline-block w-2.5 h-2.5 rounded-full border border-accent/40 border-t-accent animate-spin" />
                        )}
                        {executingId === run.id ? "Running..." : "Execute"}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {statusChip(run.status)}
                    {run.epistemic_status && epistemicChip(run.epistemic_status)}
                    <span className="text-[10px] text-muted">
                      {new Date(run.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-1">
            {selected ? (
              <div className="rounded-lg border border-border bg-surface p-4 sticky top-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted font-mono">
                    {selected.id.slice(0, 20)}
                  </span>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    &#x2715;
                  </button>
                </div>

                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {selected.question}
                </p>

                <div className="flex flex-wrap gap-2">
                  {statusChip(selected.status)}
                  {selected.epistemic_status && epistemicChip(selected.epistemic_status)}
                </div>

                <div className="text-[11px] text-muted space-y-1">
                  <div>
                    <span className="text-muted/60">Created:</span>{" "}
                    {new Date(selected.created_at).toLocaleString()}
                  </div>
                  {selected.completed_at && (
                    <div>
                      <span className="text-muted/60">Completed:</span>{" "}
                      {new Date(selected.completed_at).toLocaleString()}
                    </div>
                  )}
                </div>

                {selected.parameters &&
                  Object.keys(selected.parameters).length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5">
                        Parameters
                      </p>
                      <div className="space-y-1">
                        {Object.entries(selected.parameters).map(([k, v]) => (
                          <div
                            key={k}
                            className="flex items-start gap-2 text-[11px]"
                          >
                            <span className="text-accent font-mono shrink-0">
                              {k}
                            </span>
                            <span className="text-foreground/80 break-all">
                              {JSON.stringify(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">
                    Outcome Distribution
                  </p>
                  <OutcomeDistribution
                    distribution={selected.outcome_distribution}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted text-center">
                Select a run to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Extracted form component to avoid duplication between empty-state and inline-create contexts
function CreateForm({
  question,
  paramsRaw,
  paramsError,
  submitError,
  submitting,
  onQuestionChange,
  onParamsChange,
  onParamsBlur,
  onSubmit,
  onCancel,
}: {
  question: string;
  paramsRaw: string;
  paramsError: string | null;
  submitError: string | null;
  submitting: boolean;
  onQuestionChange: (v: string) => void;
  onParamsChange: (v: string) => void;
  onParamsBlur: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 mb-6 space-y-3">
      <div>
        <label className="block text-xs text-muted mb-1">
          Scenario question <span className="text-red-400">*</span>
        </label>
        <textarea
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          rows={3}
          placeholder="What if I shipped a new feature next week?"
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent resize-none"
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">
          Parameters{" "}
          <span className="text-muted/50">(optional JSON)</span>
        </label>
        <textarea
          value={paramsRaw}
          onChange={(e) => onParamsChange(e.target.value)}
          onBlur={onParamsBlur}
          rows={2}
          placeholder='{"horizon": "1w", "confidence": 0.8}'
          className={`w-full rounded border px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none resize-none bg-surface font-mono ${
            paramsError
              ? "border-red-400/60 focus:border-red-400"
              : "border-border focus:border-accent"
          }`}
        />
        {paramsError && (
          <p className="mt-1 text-[11px] text-red-400">{paramsError}</p>
        )}
      </div>
      {submitError && (
        <p className="text-[11px] text-red-400">{submitError}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={!question.trim() || submitting || !!paramsError}
          className="rounded bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating..." : "Create run"}
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
