"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeading } from "@/components/ui/PageHeading";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import {
  activatePrompt,
  createSelfModifyApproval,
  evaluatePrompt,
  getEvolutionPrompts,
  getEvolutionTimeline,
  grantApproval,
  proposePromptVersion,
} from "@/lib/curlyos";
import type {
  EvalResult,
  EvalTaskDetail,
  EvolutionTimelineItem,
  EvolutionEventType,
  PromptVersion,
  PromptVersionStatus,
} from "@/lib/curlyos-types";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── spinner ───────────────────────────────────────────────────────────────────

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-current/30 border-t-current animate-spin ${className}`}
    />
  );
}

// ── status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: PromptVersionStatus }) {
  const map: Record<PromptVersionStatus, string> = {
    active: "text-green-400 bg-green-400/10 border-green-400/30",
    candidate: "text-accent bg-accent/10 border-accent/30",
    held: "text-red-400 bg-red-400/10 border-red-400/30",
    retired: "text-muted bg-surface-2 border-border",
  };
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono ${map[status]}`}
    >
      {status}
    </span>
  );
}

// ── verdict chip ──────────────────────────────────────────────────────────────

function VerdictChip({ verdict }: { verdict: "pass" | "held" }) {
  return verdict === "pass" ? (
    <span className="inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono text-green-400 bg-green-400/10 border-green-400/30">
      pass
    </span>
  ) : (
    <span className="inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono text-red-400 bg-red-400/10 border-red-400/30">
      held
    </span>
  );
}

// ── timeline entry ────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<EvolutionEventType, string> = {
  "evolution.candidate.proposed": "◎",
  "evolution.eval.completed": "◈",
  "evolution.candidate.held": "⊗",
  "evolution.prompt.activated": "◉",
};

function timelineLabel(item: EvolutionTimelineItem): React.ReactNode {
  const d = item.data;
  const name = (d.name as string | undefined) ?? item.subject ?? "unknown";
  const version = d.version as number | undefined;
  const vStr = version !== undefined ? `v${version}` : "";

  switch (item.type) {
    case "evolution.candidate.proposed": {
      const notes = d.notes as string | undefined;
      return (
        <span>
          <span className="text-accent font-mono">{vStr} of {name}</span> proposed
          {notes ? ` — ${notes}` : ""}
        </span>
      );
    }
    case "evolution.eval.completed": {
      const passRate = d.pass_rate as number | undefined;
      const baseline = d.baseline as number | undefined;
      const verdict = d.verdict as "pass" | "held" | undefined;
      return (
        <span className="flex items-center gap-2 flex-wrap">
          <span>
            <span className="text-accent font-mono">{vStr} of {name}</span>
            {" "}scored{" "}
            <span className="font-mono">
              {passRate !== undefined ? `${Math.round(passRate * 100)}%` : "—"}
            </span>
            {baseline !== undefined ? (
              <span className="text-muted">
                {" "}vs baseline {Math.round(baseline * 100)}%
              </span>
            ) : null}
          </span>
          {verdict && <VerdictChip verdict={verdict} />}
        </span>
      );
    }
    case "evolution.candidate.held": {
      const reasons = d.reasons as string[] | undefined;
      return (
        <span>
          <span className="text-red-400 font-mono">{vStr} of {name}</span> held
          {reasons && reasons.length > 0 ? (
            <ul className="mt-1 ml-3 list-disc list-inside space-y-0.5">
              {reasons.map((r, i) => (
                <li key={i} className="text-[10px] text-muted">
                  {r}
                </li>
              ))}
            </ul>
          ) : null}
        </span>
      );
    }
    case "evolution.prompt.activated": {
      const approvalId = d.approval_id as string | undefined;
      return (
        <span>
          <span className="text-green-400 font-mono">{vStr} of {name}</span> activated
          {approvalId ? (
            <span className="text-muted font-mono"> under approval {approvalId.slice(0, 8)}&hellip;</span>
          ) : null}
        </span>
      );
    }
    default:
      return <span>{item.type}</span>;
  }
}

function TimelineEntry({ item }: { item: EvolutionTimelineItem }) {
  const icon = EVENT_ICONS[item.type] ?? "○";
  const iconColor =
    item.type === "evolution.prompt.activated"
      ? "text-green-400"
      : item.type === "evolution.candidate.held"
      ? "text-red-400"
      : item.type === "evolution.eval.completed"
      ? "text-yellow-400"
      : "text-accent";

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={`text-base leading-5 ${iconColor}`}>{icon}</span>
        <div className="flex-1 w-px bg-border/50 mt-1" />
      </div>
      <div className="pb-4 min-w-0 flex-1">
        <p className="text-xs text-foreground leading-relaxed">
          {timelineLabel(item)}
        </p>
        <p className="mt-0.5 text-[10px] text-muted font-mono">
          {fmtDateTime(item.at)}
        </p>
      </div>
    </div>
  );
}

// ── eval details (collapsible) ────────────────────────────────────────────────

function EvalDetails({ result }: { result: EvalResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 rounded border border-border bg-surface-2/20 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-surface-2/40"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Eval details ({result.details.length} tasks)
        </span>
        <span className="text-[10px] text-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {result.details.map((t: EvalTaskDetail, i: number) => (
            <div key={i} className="flex gap-2 items-start">
              <span
                className={`text-[10px] font-mono shrink-0 ${
                  t.pass ? "text-green-400" : "text-red-400"
                }`}
              >
                {t.pass ? "PASS" : "FAIL"}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-mono text-muted">{t.task}</p>
                <p className="text-[10px] text-muted/70">{t.why}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── prompt version row ────────────────────────────────────────────────────────

interface PromptRowProps {
  pv: PromptVersion;
  onReload: () => void;
}

function PromptRow({ pv, onReload }: PromptRowProps) {
  const toast = useToast();
  const [evalBusy, setEvalBusy] = useState(false);
  const [activateBusy, setActivateBusy] = useState(false);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canEvaluate =
    pv.status === "candidate" && pv.eval_decision === null;
  const canActivate =
    pv.status === "candidate" && pv.eval_decision === "promote";

  const handleEvaluate = async () => {
    setEvalBusy(true);
    try {
      const res = await evaluatePrompt(pv.id);
      setEvalResult(res);
      toast.success(
        `Eval complete — ${Math.round(res.pass_rate * 100)}% pass (verdict: ${res.verdict})`,
      );
      onReload();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 503) {
        toast.error("LLM unavailable — try again shortly.");
      } else {
        toast.error("Evaluation failed.");
      }
    } finally {
      setEvalBusy(false);
    }
  };

  const handleActivate = async () => {
    setConfirmOpen(false);
    setActivateBusy(true);
    try {
      const apv = await createSelfModifyApproval(pv.id);
      await grantApproval(apv.apv_id);
      await activatePrompt(pv.id, apv.apv_id);
      toast.success(`${pv.name} v${pv.version} activated.`);
      onReload();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const detail = (err as { detail?: string }).detail;
      if (status === 409) {
        toast.error(`Activation blocked: ${detail ?? "gates unmet"}`);
      } else {
        toast.error("Activation failed.");
      }
    } finally {
      setActivateBusy(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-foreground">v{pv.version}</span>
            <StatusChip status={pv.status} />
            {pv.pass_rate !== null && (
              <span className="text-[10px] font-mono text-muted">
                {Math.round(pv.pass_rate * 100)}% pass
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {canEvaluate && (
              <button
                onClick={handleEvaluate}
                disabled={evalBusy}
                className="rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:text-yellow-400 hover:border-yellow-400/40 disabled:opacity-40 flex items-center gap-1"
              >
                {evalBusy && <Spinner className="w-2.5 h-2.5" />}
                {evalBusy ? "Evaluating…" : "Evaluate"}
              </button>
            )}
            {canActivate && (
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={activateBusy}
                className="rounded border border-green-400/40 bg-green-400/10 px-2 py-0.5 text-[10px] text-green-400 hover:bg-green-400/20 disabled:opacity-40 flex items-center gap-1"
              >
                {activateBusy && <Spinner className="w-2.5 h-2.5" />}
                {activateBusy ? "Activating…" : "Activate"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-1.5 space-y-0.5">
          {pv.notes && (
            <p className="text-[11px] text-muted">{pv.notes}</p>
          )}
          <div className="flex gap-3 flex-wrap">
            {pv.proposed_by && (
              <span className="text-[10px] text-muted font-mono">
                by {pv.proposed_by}
              </span>
            )}
            <span className="text-[10px] text-muted font-mono">
              proposed {fmtDate(pv.created_at)}
            </span>
            {pv.activated_at && (
              <span className="text-[10px] text-green-400 font-mono">
                activated {fmtDate(pv.activated_at)}
              </span>
            )}
          </div>
        </div>

        {evalResult && <EvalDetails result={evalResult} />}
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Activate prompt version"
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            This changes how the Executive plans. Proceed?
          </p>
          <p className="text-xs text-muted">
            A self-modification approval will be created and immediately granted,
            then <span className="font-mono">{pv.name} v{pv.version}</span> will
            become the active version.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleActivate}
              className="rounded bg-green-500/80 px-4 py-1.5 text-sm text-white hover:bg-green-500"
            >
              Activate
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              className="rounded border border-border px-4 py-1.5 text-sm text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── prompt group ──────────────────────────────────────────────────────────────

function PromptGroup({
  name,
  versions,
  onReload,
}: {
  name: string;
  versions: PromptVersion[];
  onReload: () => void;
}) {
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  return (
    <div className="mb-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2 font-mono">
        {name}
      </h3>
      <div className="space-y-2">
        {sorted.map((pv) => (
          <PromptRow key={pv.id} pv={pv} onReload={onReload} />
        ))}
      </div>
    </div>
  );
}

// ── propose modal ─────────────────────────────────────────────────────────────

const DEFAULT_NAMES = ["executive.plan", "memory.summarize", "reflection.weekly"];

interface ProposeModalProps {
  existingNames: string[];
  onClose: () => void;
  onDone: () => void;
}

function ProposeModal({ existingNames, onClose, onDone }: ProposeModalProps) {
  const toast = useToast();
  const allNames = Array.from(new Set([...DEFAULT_NAMES, ...existingNames]));

  const [nameMode, setNameMode] = useState<"select" | "free">("select");
  const [selectedName, setSelectedName] = useState(allNames[0] ?? "executive.plan");
  const [freeName, setFreeName] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const effectiveName =
    nameMode === "select" ? selectedName : freeName.trim();

  const save = async () => {
    if (!effectiveName) {
      setError("Name is required.");
      return;
    }
    if (!content.trim()) {
      setError("Content is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await proposePromptVersion({
        name: effectiveName,
        content: content.trim(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success(`${effectiveName} version proposed.`);
      onDone();
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "Failed to propose version.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Propose a new candidate version for a prompt. It will be evaluated
        before it can be activated.
      </p>

      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setNameMode("select")}
            className={`text-[11px] rounded border px-2 py-0.5 ${
              nameMode === "select"
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            Select name
          </button>
          <button
            onClick={() => setNameMode("free")}
            className={`text-[11px] rounded border px-2 py-0.5 ${
              nameMode === "free"
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            Custom name
          </button>
        </div>

        {nameMode === "select" ? (
          <select
            ref={firstRef}
            value={selectedName}
            onChange={(e) => setSelectedName(e.target.value)}
            className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
          >
            {allNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={freeName}
            onChange={(e) => setFreeName(e.target.value)}
            placeholder="e.g. planner.daily"
            className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
          />
        )}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the full prompt content here…"
          rows={8}
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent resize-y font-mono"
        />

        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional) — what changed and why"
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !effectiveName || !content.trim()}
          className="rounded bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/80 disabled:opacity-40 flex items-center gap-2"
        >
          {saving && <Spinner className="w-3 h-3" />}
          {saving ? "Proposing…" : "Propose version"}
        </button>
        <button
          onClick={onClose}
          className="rounded border border-border px-4 py-1.5 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function EvolutionPage() {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [timeline, setTimeline] = useState<EvolutionTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposeOpen, setProposeOpen] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      getEvolutionPrompts().catch(() => ({ items: [] as PromptVersion[], count: 0 })),
      getEvolutionTimeline(50).catch(() => ({ items: [] as EvolutionTimelineItem[] })),
    ]).then(([pd, td]) => {
      setPrompts(pd.items);
      setTimeline(td.items);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Group prompts by name
  const grouped = prompts.reduce<Record<string, PromptVersion[]>>((acc, pv) => {
    const bucket = acc[pv.name] ?? [];
    bucket.push(pv);
    acc[pv.name] = bucket;
    return acc;
  }, {});

  const existingNames = Object.keys(grouped);
  const isEmpty = !loading && prompts.length === 0 && timeline.length === 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Evolution"
        subtitle="How the system changes itself"
        eyebrow="Self-modification"
        actions={
          !loading ? (
            <button
              onClick={() => setProposeOpen(true)}
              className="rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20"
            >
              + Propose version
            </button>
          ) : undefined
        }
      />

      {loading && (
        <div className="flex items-center justify-center h-40 text-muted text-sm">
          Loading…
        </div>
      )}

      {isEmpty && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <div className="text-4xl mb-3 text-muted">⬡</div>
          <h2 className="text-base font-semibold text-foreground mb-1">
            No evolution yet
          </h2>
          <p className="text-sm text-muted mb-6 max-w-sm mx-auto">
            The system has not changed itself. Propose a candidate prompt version
            to begin the eval-gated evolution cycle.
          </p>
          <button
            onClick={() => setProposeOpen(true)}
            className="rounded-lg border border-accent bg-accent/10 px-5 py-2.5 text-sm text-accent hover:bg-accent/20 mx-auto"
          >
            Propose first version
          </button>
        </div>
      )}

      {!loading && !isEmpty && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          {/* Left — prompt versions */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-4">
              Prompt versions
            </h2>
            {existingNames.map((name) => (
              <PromptGroup
                key={name}
                name={name}
                versions={grouped[name] ?? []}
                onReload={load}
              />
            ))}
          </div>

          {/* Right — timeline */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-4">
              Timeline
            </h2>
            {timeline.length === 0 ? (
              <p className="text-xs text-muted">No events yet.</p>
            ) : (
              <div>
                {[...timeline]
                  .sort((a, b) => b.seq - a.seq)
                  .map((item) => (
                    <TimelineEntry key={item.seq} item={item} />
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Show timeline alone when there are no prompts yet but there are events */}
      {!loading && prompts.length === 0 && timeline.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-4">
            Timeline
          </h2>
          <div>
            {[...timeline]
              .sort((a, b) => b.seq - a.seq)
              .map((item) => (
                <TimelineEntry key={item.seq} item={item} />
              ))}
          </div>
        </div>
      )}

      <Modal
        open={proposeOpen}
        onClose={() => setProposeOpen(false)}
        title="Propose new prompt version"
        widthClass="max-w-2xl"
      >
        <ProposeModal
          existingNames={existingNames}
          onClose={() => setProposeOpen(false)}
          onDone={() => {
            setProposeOpen(false);
            load();
          }}
        />
      </Modal>
    </div>
  );
}
