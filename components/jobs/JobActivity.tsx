"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAgentRun, grantApproval, denyApproval } from "@/lib/curlyos";
import type { AgentRunDetail, AgentRunStatus } from "@/lib/curlyos-types";

const ACTIVE: AgentRunStatus[] = ["running", "parked"];
const POLL_MS = 2000;

// Live view of a single Executive run that backs a job firing: polls the run
// trace while the run is active and renders its step-by-step progress, any
// pending approval (with grant/deny), and the final summary.
export function JobActivity({
  runId,
  onTerminal,
}: {
  runId: string;
  onTerminal?: (status: AgentRunStatus) => void;
}) {
  const [run, setRun] = useState<AgentRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const lastStatus = useRef<AgentRunStatus | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        const d = await getAgentRun(runId);
        if (!alive) return;
        setRun(d);
        setLoading(false);
        if (lastStatus.current && ACTIVE.includes(lastStatus.current) && !ACTIVE.includes(d.status)) {
          onTerminal?.(d.status); // just became terminal
        }
        lastStatus.current = d.status;
        if (!ACTIVE.includes(d.status) && timer) {
          clearInterval(timer);
          timer = null;
        }
      } catch {
        if (alive) setLoading(false);
      }
    };

    tick();
    timer = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const decide = async (apvId: string, decision: "grant" | "deny") => {
    setBusy(true);
    setErr("");
    try {
      if (decision === "grant") await grantApproval(apvId);
      else await denyApproval(apvId, "denied from jobs view");
      const d = await getAgentRun(runId);
      setRun(d);
    } catch {
      setErr(`Failed to ${decision}.`);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !run) {
    return <div className="px-1 py-2 text-xs text-muted">Loading activity…</div>;
  }
  if (!run) {
    return <div className="px-1 py-2 text-xs text-muted">No run trace available.</div>;
  }

  const active = ACTIVE.includes(run.status);
  const steps = run.actions;
  const pending = run.approvals.filter((a) => a.state === "pending");

  return (
    <div className="space-y-3">
      {/* Live status line */}
      <div className="flex items-center gap-2 text-xs">
        {run.status === "running" && (
          <>
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            <span className="text-accent">
              Working{steps.length > 0 ? ` · step ${steps.length + 1}` : "…"}
              {steps.length > 0 && (
                <span className="text-muted"> · last: {steps[steps.length - 1].payload.tool}</span>
              )}
            </span>
          </>
        )}
        {run.status === "parked" && (
          <span className="text-yellow-400">Paused — needs your approval</span>
        )}
        {run.status === "completed" && (
          <span className="text-green-400">Completed · {steps.length} step{steps.length !== 1 ? "s" : ""}</span>
        )}
        {run.status === "failed" && <span className="text-red-400">Failed</span>}
        {run.status === "cancelled" && <span className="text-muted">Cancelled</span>}
      </div>

      {/* Step rail */}
      {steps.length > 0 && (
        <ol className="space-y-1.5">
          {steps.map((a, i) => {
            const denied = a.observation && "denied" in (a.observation as Record<string, unknown>);
            return (
              <li key={a.id} className="flex items-start gap-2 text-xs">
                <span
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                    denied
                      ? "bg-red-400/15 text-red-400"
                      : "bg-green-400/15 text-green-400"
                  }`}
                >
                  {denied ? "✕" : "✓"}
                </span>
                <div className="min-w-0">
                  <span className="font-mono text-foreground">{a.payload.tool}</span>
                  {a.payload.why && <span className="text-muted"> — {a.payload.why}</span>}
                </div>
              </li>
            );
          })}
          {run.status === "running" && (
            <li className="flex items-center gap-2 text-xs text-muted">
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              </span>
              <span className="italic">thinking…</span>
            </li>
          )}
        </ol>
      )}

      {active && steps.length === 0 && run.status === "running" && (
        <p className="text-xs italic text-muted">Planning the steps…</p>
      )}

      {/* Pending approval inline */}
      {pending.map((apv) => (
        <div key={apv.apv_id} className="rounded border border-yellow-400/30 bg-yellow-400/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-yellow-400">
              Approval required
            </span>
            <span className="font-mono text-[10px] text-muted">{apv.action_class}</span>
            {apv.payload?.tool && (
              <span className="font-mono text-[10px] text-muted">· {apv.payload.tool}</span>
            )}
          </div>
          {apv.payload?.why && <p className="mt-1 text-xs text-foreground">{apv.payload.why}</p>}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => decide(apv.apv_id, "grant")}
              disabled={busy}
              className="rounded bg-green-500/90 px-2.5 py-1 text-xs text-white hover:bg-green-500 disabled:opacity-40"
            >
              Grant
            </button>
            <button
              onClick={() => decide(apv.apv_id, "deny")}
              disabled={busy}
              className="rounded border border-red-400/40 px-2.5 py-1 text-xs text-red-400 hover:bg-red-400/10 disabled:opacity-40"
            >
              Deny
            </button>
          </div>
        </div>
      ))}

      {/* Final summary */}
      {run.result?.summary && (
        <div className="rounded border border-border bg-surface-2/40 p-3">
          <p className="text-xs leading-relaxed text-foreground">{run.result.summary}</p>
        </div>
      )}
      {run.error && <p className="text-xs text-red-400">{run.error}</p>}
      {err && <p className="text-xs text-red-400">{err}</p>}

      <Link href={`/runs/${runId}`} className="inline-block text-[11px] text-accent hover:underline">
        full run trace &#8250;
      </Link>
    </div>
  );
}
