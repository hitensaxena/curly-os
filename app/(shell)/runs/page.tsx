"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeading } from "@/components/ui/PageHeading";
import { useEventStream } from "@/lib/use-event-stream";
import { createAgentRun, getAgentRuns } from "@/lib/curlyos";
import type { AgentRun, AgentRunStatus, SseEvent } from "@/lib/curlyos-types";

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

function agentLabel(agent: string): string {
  if (agent === "Executive") return "Executive";
  if (agent.startsWith("workflow:")) return agent.slice("workflow:".length);
  return agent;
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

function AgentChip({ agent }: { agent: string }) {
  const isExec = agent === "Executive";
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono ${
      isExec
        ? "text-purple-400 bg-purple-400/10 border-purple-400/30"
        : "text-cyan-400 bg-cyan-400/10 border-cyan-400/30"
    }`}>
      {agentLabel(agent)}
    </span>
  );
}

// ── run row ───────────────────────────────────────────────────────────────────

function RunRow({ run }: { run: AgentRun }) {
  const done = run.finished_at !== null;
  return (
    <Link
      href={`/runs/${run.id}`}
      className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2/40 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{run.task}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <StatusChip status={run.status} />
          <AgentChip agent={run.agent} />
          <span className="text-[10px] text-muted font-mono">
            {new Date(run.created_at).toLocaleString()}
          </span>
          {done && (
            <span className="text-[10px] text-muted font-mono">
              {formatDuration(run.created_at, run.finished_at)}
            </span>
          )}
        </div>
        {run.result?.summary && (
          <p className="mt-1 text-xs text-muted truncate">{run.result.summary}</p>
        )}
        {run.error && (
          <p className="mt-1 text-xs text-red-400 truncate">{run.error}</p>
        )}
      </div>
      <span className="text-muted text-xs shrink-0 mt-0.5">&#8250;</span>
    </Link>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function RunsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    getAgentRuns({ limit: 50 })
      .then((d) => {
        // Sort newest first
        const sorted = [...d.items].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setRuns(sorted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEventStream(["agent"], (evt: SseEvent) => {
    if (evt.type.startsWith("agent.run.")) {
      load();
    }
  });

  const handleSubmit = async () => {
    const t = task.trim();
    if (!t) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await createAgentRun({ task: t });
      setTask("");
      router.push(`/runs/${result.run_id}`);
    } catch {
      setSubmitError("Failed to start run.");
      setSubmitting(false);
    }
  };

  const activeCount = runs.filter((r) => r.status === "running" || r.status === "parked").length;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Runs"
        eyebrow="Agent OS"
        subtitle={
          loading
            ? "Loading..."
            : `${runs.length} run${runs.length !== 1 ? "s" : ""}${
                activeCount > 0 ? ` · ${activeCount} active` : ""
              }`
        }
      />

      {/* New run input */}
      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <p className="text-xs text-muted mb-2 font-semibold uppercase tracking-wide">
          New Run
        </p>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Describe the task for the agent..."
            disabled={submitting}
            className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !task.trim()}
            className="rounded bg-accent px-4 py-2 text-sm text-white hover:bg-accent/80 disabled:opacity-40"
          >
            {submitting ? "Starting..." : "Run"}
          </button>
        </div>
        {submitError && (
          <p className="mt-1.5 text-xs text-red-400">{submitError}</p>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40 text-muted text-sm">
          Loading...
        </div>
      )}

      {!loading && runs.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <div className="text-4xl mb-3">&#9670;</div>
          <h2 className="text-base font-semibold text-foreground mb-1">No runs yet</h2>
          <p className="text-sm text-muted max-w-sm mx-auto">
            Start a run by describing a task above. The agent will execute it and report back.
          </p>
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div className="rounded-lg border border-border bg-surface divide-y divide-border">
          {runs.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}
