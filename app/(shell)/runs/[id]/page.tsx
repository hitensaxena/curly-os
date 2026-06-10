"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/PageHeading";
import { useEventStream } from "@/lib/use-event-stream";
import {
  cancelAgentRun,
  getAgentRun,
  resumeAgentRun,
} from "@/lib/curlyos";
import type {
  AgentRunAction,
  AgentRunApproval,
  AgentRunDetail,
  AgentRunStatus,
  SseEvent,
} from "@/lib/curlyos-types";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDuration(created: string, finished: string | null): string {
  const end = finished ? new Date(finished) : new Date();
  const ms = end.getTime() - new Date(created).getTime();
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}

function truncateJson(obj: Record<string, unknown>, maxChars = 400): string {
  const str = JSON.stringify(obj, null, 2);
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + "\n  … (truncated)";
}

// ── chips ─────────────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: AgentRunStatus }) {
  const base = "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono";
  const map: Record<AgentRunStatus, string> = {
    running:   "text-accent  bg-accent/10  border-accent/30",
    parked:    "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    completed: "text-green-400  bg-green-400/10  border-green-400/30",
    failed:    "text-red-400    bg-red-400/10    border-red-400/30",
    cancelled: "text-muted      bg-surface-2     border-border",
  };
  const pulse = status === "running" ? (
    <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
  ) : null;
  return (
    <span className={`${base} ${map[status]}`}>
      {pulse}
      {status}
    </span>
  );
}

function ApprovalStateChip({ state }: { state: string }) {
  const map: Record<string, string> = {
    pending:  "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    granted:  "text-green-400  bg-green-400/10  border-green-400/30",
    denied:   "text-red-400    bg-red-400/10    border-red-400/30",
    expired:  "text-muted      bg-surface-2     border-border",
  };
  const cls = map[state] ?? "text-muted bg-surface-2 border-border";
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono ${cls}`}>
      {state}
    </span>
  );
}

// ── collapsible pre ───────────────────────────────────────────────────────────

function CollapsibleCode({
  label,
  content,
}: {
  label: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] text-muted hover:text-foreground flex items-center gap-1"
      >
        <span>{open ? "▾" : "▸"}</span>
        <span>{label}</span>
      </button>
      {open && (
        <pre className="mt-1 rounded bg-surface-2 border border-border px-3 py-2 text-[11px] text-muted overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
          {content}
        </pre>
      )}
    </div>
  );
}

// ── inline approval ───────────────────────────────────────────────────────────

function InlineApproval({ apv }: { apv: AgentRunApproval }) {
  return (
    <div className="mt-2 rounded border border-yellow-400/20 bg-yellow-400/5 px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-yellow-400">
          Approval
        </span>
        <ApprovalStateChip state={apv.state} />
        <span className="text-[10px] text-muted font-mono">{apv.action_class}</span>
      </div>
      {apv.payload?.why && (
        <p className="mt-1 text-xs text-muted">{apv.payload.why}</p>
      )}
      {apv.payload?.tool && (
        <p className="mt-0.5 text-[10px] text-muted font-mono">tool: {apv.payload.tool}</p>
      )}
    </div>
  );
}

// ── action step card ──────────────────────────────────────────────────────────

interface ActionCardProps {
  action: AgentRunAction;
  index: number;
  linkedApprovals: AgentRunApproval[];
}

function ActionCard({ action, index, linkedApprovals }: ActionCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="text-[10px] font-mono text-muted shrink-0 mt-0.5 w-6 text-right">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground font-mono">
              {action.payload.tool}
            </span>
            <span className="text-[10px] text-muted font-mono">{action.kind}</span>
          </div>
          {action.payload.why && (
            <p className="mt-1 text-xs text-muted">{action.payload.why}</p>
          )}
          <CollapsibleCode
            label="args"
            content={JSON.stringify(action.payload.args, null, 2)}
          />
          {action.observation && (
            <CollapsibleCode
              label="observation"
              content={truncateJson(action.observation)}
            />
          )}
          {linkedApprovals.map((apv) => (
            <InlineApproval key={apv.apv_id} apv={apv} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [run, setRun] = useState<AgentRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const load = () => {
    getAgentRun(id)
      .then((d) => { setRun(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEventStream(["agent"], (evt: SseEvent) => {
    const sub = typeof evt.data?.run_id === "string" ? evt.data.run_id : evt.subject;
    if (sub === id) load();
  });

  const handleResume = async () => {
    setActionBusy(true);
    setActionError("");
    try {
      await resumeAgentRun(id);
      load();
    } catch {
      setActionError("Failed to resume.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancel = async () => {
    setActionBusy(true);
    setActionError("");
    try {
      await cancelAgentRun(id);
      load();
    } catch {
      setActionError("Failed to cancel.");
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-sm">
        Loading...
      </div>
    );
  }

  if (!run) {
    return (
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
        <nav className="mb-3 text-xs text-muted">
          <Link href="/runs" className="hover:text-foreground">Runs</Link>
          <span aria-hidden> / </span>
          <span className="text-foreground">{id.slice(0, 8)}</span>
        </nav>
        <p className="text-sm text-muted">Run not found.</p>
      </div>
    );
  }

  // Map approvals to their cursor (action step) for inline display
  const approvalsByCursor = new Map<string, AgentRunApproval[]>();
  for (const apv of run.approvals) {
    const cursor = apv.payload?.cursor ?? "";
    if (!approvalsByCursor.has(cursor)) approvalsByCursor.set(cursor, []);
    approvalsByCursor.get(cursor)!.push(apv);
  }

  const lastToolCall = run.tool_calls.length > 0
    ? run.tool_calls[run.tool_calls.length - 1]
    : null;

  const isActive = run.status === "running" || run.status === "parked";
  const done = run.finished_at !== null;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      {/* Breadcrumb */}
      <nav className="mb-3 text-xs text-muted">
        <Link href="/runs" className="hover:text-foreground">Runs</Link>
        <span aria-hidden> / </span>
        <span className="text-foreground font-mono">{id.slice(0, 8)}</span>
      </nav>

      <PageHeading
        title={run.task}
        eyebrow="Agent OS"
        subtitle={
          done
            ? `${run.agent} · ${formatDuration(run.created_at, run.finished_at)}`
            : run.agent
        }
        actions={
          <div className="flex items-center gap-2">
            <StatusChip status={run.status} />
            {run.status === "parked" && (
              <button
                onClick={handleResume}
                disabled={actionBusy}
                className="rounded bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/80 disabled:opacity-40"
              >
                {actionBusy ? "..." : "Resume"}
              </button>
            )}
            {(run.status === "running" || run.status === "parked") && (
              <button
                onClick={handleCancel}
                disabled={actionBusy}
                className="rounded border border-red-400/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10 disabled:opacity-40"
              >
                {actionBusy ? "..." : "Cancel"}
              </button>
            )}
          </div>
        }
      />

      {actionError && (
        <p className="mb-4 text-xs text-red-400">{actionError}</p>
      )}

      {/* Summary / Error */}
      {run.result?.summary && (
        <div className="mb-6 rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-muted mb-1 font-semibold uppercase tracking-wide">
            Summary
          </p>
          <p className="text-sm text-foreground">{run.result.summary}</p>
          {run.result.steps !== undefined && (
            <p className="mt-1 text-xs text-muted">{run.result.steps} steps</p>
          )}
        </div>
      )}

      {run.error && (
        <div className="mb-6 rounded-lg border border-red-400/20 bg-red-400/5 p-4">
          <p className="text-xs text-red-400 mb-1 font-semibold uppercase tracking-wide">
            Error
          </p>
          <p className="text-sm text-red-300">{run.error}</p>
        </div>
      )}

      {/* Step timeline */}
      {run.actions.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
            Steps ({run.actions.length})
          </h2>
          <div className="space-y-3">
            {run.actions.map((action, i) => {
              const cursor = action.payload.cursor ?? action.id;
              const linked = approvalsByCursor.get(cursor) ?? [];
              return (
                <ActionCard
                  key={action.id}
                  action={action}
                  index={i}
                  linkedApprovals={linked}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Approvals without matching action step */}
      {run.approvals.length > 0 && run.actions.length === 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
            Approvals ({run.approvals.length})
          </h2>
          <div className="space-y-2">
            {run.approvals.map((apv) => (
              <div key={apv.apv_id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <ApprovalStateChip state={apv.state} />
                  <span className="text-xs font-mono text-muted">{apv.action_class}</span>
                </div>
                {apv.payload?.why && (
                  <p className="mt-1 text-xs text-muted">{apv.payload.why}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty steps */}
      {!isActive && run.actions.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-6 text-center mb-6">
          <p className="text-sm text-muted">No steps recorded.</p>
        </div>
      )}

      {/* Hash-chain footer */}
      {run.tool_calls.length > 0 && (
        <div className="rounded-lg border border-border bg-surface/50 px-4 py-3 flex items-center gap-3 text-xs text-muted font-mono">
          <span>{run.tool_calls.length} tool call{run.tool_calls.length !== 1 ? "s" : ""}</span>
          {lastToolCall && (
            <>
              <span aria-hidden>·</span>
              <span title={lastToolCall.entry_hash}>
                last hash: {lastToolCall.entry_hash.slice(0, 12)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
