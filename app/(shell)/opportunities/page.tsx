"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/PageHeading";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createGoal,
  getOpportunities,
  resolveOpportunity,
  scanDiscovery,
} from "@/lib/curlyos";
import type {
  CreateGoalBody,
  GoalHorizon,
  Opportunity,
  OpportunityStatus,
} from "@/lib/curlyos-types";

// ── status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: OpportunityStatus }) {
  const map: Record<OpportunityStatus, string> = {
    detected: "text-blue-400 bg-blue-400/10 border-blue-400/30",
    scored: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
    accepted: "text-green-400 bg-green-400/10 border-green-400/30",
    rejected: "text-muted bg-surface-2 border-border",
    expired: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  };
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono ${map[status]}`}
    >
      {status}
    </span>
  );
}

// ── meter bar (0–1 range, labeled) ───────────────────────────────────────────

function MiniMeter({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="w-16 shrink-0 text-muted font-mono uppercase tracking-wide">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-7 text-right text-muted tabular-nums">{pct}%</span>
    </div>
  );
}

// ── score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(Math.min(1, Math.max(0, score)) * 100);
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="text-muted font-mono uppercase tracking-wide w-10 shrink-0">
        Score
      </span>
      <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-muted tabular-nums w-7 text-right">{pct}</span>
    </div>
  );
}

// ── accept modal ──────────────────────────────────────────────────────────────

interface AcceptModalProps {
  opportunity: Opportunity;
  onClose: () => void;
  onDone: (goalId: string) => void;
}

function AcceptModal({ opportunity, onClose, onDone }: AcceptModalProps) {
  const [title, setTitle] = useState(opportunity.title);
  const [horizon, setHorizon] = useState<GoalHorizon>(null);
  const [successCriteria, setSuccessCriteria] = useState("");
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
      if (horizon) body.horizon = horizon;
      if (successCriteria.trim()) body.success_criteria = successCriteria.trim();
      const goal = await createGoal(body);
      await resolveOpportunity(opportunity.id, {
        accept: true,
        resolution: goal.id,
      });
      onDone(goal.id);
    } catch {
      setError("Failed to create goal or resolve opportunity.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Create a goal from this opportunity, then mark it as accepted.
      </p>
      <div className="space-y-3">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Goal title (required)"
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <select
          value={horizon ?? ""}
          onChange={(e) => setHorizon((e.target.value as GoalHorizon) || null)}
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
        >
          <option value="">Horizon (optional)</option>
          <option value="life">Life</option>
          <option value="year">Year</option>
          <option value="quarter">Quarter</option>
          <option value="month">Month</option>
        </select>
        <input
          value={successCriteria}
          onChange={(e) => setSuccessCriteria(e.target.value)}
          placeholder="Success criteria (optional)"
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="rounded bg-green-500/80 px-4 py-1.5 text-sm text-white hover:bg-green-500 disabled:opacity-40"
        >
          {saving ? "Creating goal..." : "Accept & create goal"}
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

// ── reject prompt ─────────────────────────────────────────────────────────────

interface RejectPromptProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  busy: boolean;
}

function RejectPrompt({ onConfirm, onCancel, busy }: RejectPromptProps) {
  const [reason, setReason] = useState("");

  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && reason.trim() && onConfirm(reason.trim())}
        placeholder="Reason for rejecting"
        autoFocus
        className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
      />
      <button
        onClick={() => reason.trim() && onConfirm(reason.trim())}
        disabled={busy || !reason.trim()}
        className="rounded bg-red-500/80 px-2 py-0.5 text-xs text-white hover:bg-red-500 disabled:opacity-40"
      >
        {busy ? "..." : "Confirm"}
      </button>
      <button onClick={onCancel} className="text-xs text-muted hover:text-foreground">
        Cancel
      </button>
    </div>
  );
}

// ── opportunity card ──────────────────────────────────────────────────────────

type CardAction = { type: "reject" } | { type: "accept" };

interface OpportunityCardProps {
  opp: Opportunity;
  onResolved: () => void;
}

function OpportunityCard({ opp, onResolved }: OpportunityCardProps) {
  const toast = useToast();
  const [action, setAction] = useState<CardAction | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [acceptedGoalId, setAcceptedGoalId] = useState<string | null>(null);

  const isOpen = opp.status === "detected" || opp.status === "scored";

  const handleReject = async (reason: string) => {
    setRejectBusy(true);
    try {
      await resolveOpportunity(opp.id, { accept: false, resolution: reason });
      toast.success("Opportunity rejected.");
      onResolved();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        toast.error("Already resolved.");
      } else {
        toast.error("Failed to reject opportunity.");
      }
    } finally {
      setRejectBusy(false);
      setAction(null);
    }
  };

  const handleAcceptDone = (goalId: string) => {
    setAcceptedGoalId(goalId);
    setAction(null);
    onResolved();
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-medium text-foreground">{opp.title}</h3>
              <StatusChip status={opp.status} />
            </div>
            {opp.source && (
              <span className="mt-0.5 inline-block rounded bg-surface-2 border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted">
                {opp.source}
              </span>
            )}
            {opp.description && (
              <p className="mt-1.5 text-xs text-muted">{opp.description}</p>
            )}
          </div>

          {isOpen && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setAction({ type: "accept" })}
                className="rounded border border-green-400/40 bg-green-400/10 px-2 py-0.5 text-[10px] text-green-400 hover:bg-green-400/20"
              >
                Accept
              </button>
              <button
                onClick={() =>
                  setAction(action?.type === "reject" ? null : { type: "reject" })
                }
                className="rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:text-red-400 hover:border-red-400/40"
              >
                Reject
              </button>
            </div>
          )}
        </div>

        {/* Meters */}
        {(opp.score !== null || opp.novelty !== null || opp.value_est !== null || opp.feasibility !== null) && (
          <div className="mt-3 space-y-1.5">
            {opp.score !== null ? (
              <ScoreBar score={opp.score} />
            ) : (
              <>
                <MiniMeter label="Novelty" value={opp.novelty} color="bg-purple-400" />
                <MiniMeter label="Value" value={opp.value_est} color="bg-accent" />
                <MiniMeter label="Feasibility" value={opp.feasibility} color="bg-cyan-400" />
              </>
            )}
          </div>
        )}

        {/* Evidence refs */}
        {opp.evidence_refs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {opp.evidence_refs.map((ref) => (
              <span
                key={ref}
                className="rounded bg-surface-2 border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted"
              >
                {ref}
              </span>
            ))}
          </div>
        )}

        {/* Detected date */}
        <p className="mt-2 text-[10px] text-muted font-mono">
          Detected {new Date(opp.detected_at).toLocaleDateString()}
        </p>

        {/* Resolution note (accepted/rejected) */}
        {opp.resolution && (
          <p className="mt-1 text-[10px] text-muted font-mono">
            {opp.status === "accepted" ? "Goal: " : "Reason: "}
            {opp.resolution}
          </p>
        )}

        {/* New goal link after accept */}
        {acceptedGoalId && (
          <p className="mt-1 text-[10px]">
            <Link href="/goals" className="text-accent hover:underline font-mono">
              View in Goals &rarr;
            </Link>
          </p>
        )}

        {/* Inline reject prompt */}
        {action?.type === "reject" && (
          <RejectPrompt
            onConfirm={handleReject}
            onCancel={() => setAction(null)}
            busy={rejectBusy}
          />
        )}
      </div>

      {/* Accept modal */}
      <Modal
        open={action?.type === "accept"}
        onClose={() => setAction(null)}
        title="Accept opportunity"
      >
        <AcceptModal
          opportunity={opp}
          onClose={() => setAction(null)}
          onDone={handleAcceptDone}
        />
      </Modal>
    </>
  );
}

// ── section ───────────────────────────────────────────────────────────────────

function Section({
  title,
  items,
  onResolved,
}: {
  title: string;
  items: Opportunity[];
  onResolved: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
        {title} ({items.length})
      </h2>
      <div className="space-y-3">
        {items.map((opp) => (
          <OpportunityCard key={opp.id} opp={opp} onResolved={onResolved} />
        ))}
      </div>
    </section>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function OpportunitiesPage() {
  const toast = useToast();
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = () => {
    setLoading(true);
    getOpportunities()
      .then((d) => {
        setItems(d.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await scanDiscovery();
      toast.success(
        `${result.created_count} opportunit${result.created_count !== 1 ? "ies" : "y"} found.`,
      );
      load();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 503) {
        toast.error("LLM unavailable — try again shortly.");
      } else {
        toast.error("Scan failed.");
      }
    } finally {
      setScanning(false);
    }
  };

  const open = items
    .filter((o) => o.status === "detected" || o.status === "scored")
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const accepted = items.filter((o) => o.status === "accepted");
  const rejected = items.filter((o) => o.status === "rejected" || o.status === "expired");

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Opportunities"
        subtitle={
          loading
            ? "Loading..."
            : items.length === 0
            ? "Nothing detected yet"
            : `${items.length} opportunit${items.length !== 1 ? "ies" : "y"}`
        }
        eyebrow="Discovery"
        actions={
          !loading ? (
            <button
              onClick={handleScan}
              disabled={scanning}
              className="rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {scanning && (
                <span className="inline-block w-3 h-3 rounded-full border-2 border-accent/40 border-t-accent animate-spin" />
              )}
              {scanning ? "Scanning..." : "Scan now"}
            </button>
          ) : undefined
        }
      />

      {loading && (
        <div className="flex items-center justify-center h-40 text-muted text-sm">
          Loading...
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <div className="text-4xl mb-3">&#9670;</div>
          <h2 className="text-base font-semibold text-foreground mb-1">
            Nothing detected yet
          </h2>
          <p className="text-sm text-muted mb-6 max-w-sm mx-auto">
            Run a scan to discover opportunities from your recent activity and
            context.
          </p>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="rounded-lg border border-accent bg-accent/10 px-5 py-2.5 text-sm text-accent hover:bg-accent/20 disabled:opacity-40 flex items-center gap-2 mx-auto"
          >
            {scanning && (
              <span className="inline-block w-3 h-3 rounded-full border-2 border-accent/40 border-t-accent animate-spin" />
            )}
            {scanning ? "Scanning..." : "Scan now"}
          </button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <Section title="Open" items={open} onResolved={load} />
          <Section title="Accepted" items={accepted} onResolved={load} />
          <Section title="Rejected / Expired" items={rejected} onResolved={load} />
        </>
      )}
    </div>
  );
}
