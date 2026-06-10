"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/PageHeading";
import { useEventStream } from "@/lib/use-event-stream";
import { denyApproval, getPendingApprovals, grantApproval } from "@/lib/curlyos";
import type {
  ApprovalActionResult,
  ApprovalOrigin,
  PendingApproval,
  SseEvent,
} from "@/lib/curlyos-types";

// ── helpers ───────────────────────────────────────────────────────────────────

function expiresText(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const s = Math.round(diff / 1000);
  if (s < 60) return `expires in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `expires in ${m}m`;
  const h = Math.floor(m / 60);
  return `expires in ${h}h`;
}

// ── chips ─────────────────────────────────────────────────────────────────────

function OriginChip({ origin }: { origin: ApprovalOrigin }) {
  const map: Record<ApprovalOrigin, string> = {
    agent: "text-purple-400 bg-purple-400/10 border-purple-400/30",
    human: "text-blue-400   bg-blue-400/10   border-blue-400/30",
  };
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono ${map[origin]}`}
    >
      {origin}
    </span>
  );
}

function ResumedBadge() {
  return (
    <span className="inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono text-green-400 bg-green-400/10 border-green-400/30">
      resumed
    </span>
  );
}

// ── deny dialog ───────────────────────────────────────────────────────────────

interface DenyDialogProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  busy: boolean;
}

function DenyDialog({ onConfirm, onCancel, busy }: DenyDialogProps) {
  const [reason, setReason] = useState("");
  return (
    <div className="mt-3 flex gap-2 items-center flex-wrap">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onConfirm(reason); }}
        placeholder="Reason (optional)"
        autoFocus
        className="flex-1 min-w-[160px] rounded border border-border bg-surface px-2 py-1 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
      />
      <button
        onClick={() => onConfirm(reason)}
        disabled={busy}
        className="rounded bg-red-500/80 px-3 py-1 text-xs text-white hover:bg-red-500 disabled:opacity-40"
      >
        {busy ? "..." : "Confirm deny"}
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-muted hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}

// ── collapsible args ──────────────────────────────────────────────────────────

function CollapsibleArgs({ args }: { args: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const str = JSON.stringify(args, null, 2);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] text-muted hover:text-foreground flex items-center gap-1"
      >
        <span>{open ? "▾" : "▸"}</span>
        <span>args</span>
      </button>
      {open && (
        <pre className="mt-1 rounded bg-surface-2 border border-border px-3 py-2 text-[11px] text-muted overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
          {str}
        </pre>
      )}
    </div>
  );
}

// ── approval card ─────────────────────────────────────────────────────────────

interface ApprovalCardProps {
  apv: PendingApproval;
  onGranted: (result: ApprovalActionResult) => void;
  onDenied: (result: ApprovalActionResult) => void;
}

function ApprovalCard({ apv, onGranted, onDenied }: ApprovalCardProps) {
  const [denyOpen, setDenyOpen] = useState(false);
  const [grantBusy, setGrantBusy] = useState(false);
  const [denyBusy, setDenyBusy] = useState(false);
  const [localResult, setLocalResult] = useState<ApprovalActionResult | null>(null);
  const [error, setError] = useState("");

  const handleGrant = async () => {
    setGrantBusy(true);
    setError("");
    try {
      const result = await grantApproval(apv.apv_id);
      setLocalResult(result);
      onGranted(result);
    } catch {
      setError("Failed to grant.");
    } finally {
      setGrantBusy(false);
    }
  };

  const handleDeny = async (reason: string) => {
    setDenyBusy(true);
    setError("");
    try {
      const result = await denyApproval(apv.apv_id, reason);
      setLocalResult(result);
      onDenied(result);
    } catch {
      setError("Failed to deny.");
    } finally {
      setDenyBusy(false);
    }
  };

  const expires = expiresText(apv.expires_at);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground font-mono">
              {apv.action_class}
            </span>
            <OriginChip origin={apv.origin} />
            {apv.payload?.tool && (
              <span className="text-[10px] text-muted font-mono">
                {apv.payload.tool}
              </span>
            )}
          </div>
          {apv.payload?.why && (
            <p className="mt-1 text-sm text-muted">{apv.payload.why}</p>
          )}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {apv.run_id && (
              <Link
                href={`/runs/${apv.run_id}`}
                className="text-[10px] text-accent hover:underline font-mono"
              >
                run:{apv.run_id.slice(0, 8)}
              </Link>
            )}
            {expires && (
              <span className="text-[10px] text-yellow-400 font-mono">{expires}</span>
            )}
            <span className="text-[10px] text-muted font-mono">
              {new Date(apv.created_at).toLocaleString()}
            </span>
          </div>
          {apv.payload?.args && (
            <CollapsibleArgs args={apv.payload.args} />
          )}
        </div>

        {!localResult && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleGrant}
              disabled={grantBusy || denyBusy}
              className="rounded bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/80 disabled:opacity-40"
            >
              {grantBusy ? "..." : "Grant"}
            </button>
            <button
              onClick={() => setDenyOpen((v) => !v)}
              disabled={grantBusy || denyBusy}
              className="rounded border border-red-400/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10 disabled:opacity-40"
            >
              Deny
            </button>
          </div>
        )}

        {localResult && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-muted">{localResult.state}</span>
            {localResult.resumed && <ResumedBadge />}
          </div>
        )}
      </div>

      {denyOpen && !localResult && (
        <DenyDialog
          onConfirm={handleDeny}
          onCancel={() => setDenyOpen(false)}
          busy={denyBusy}
        />
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  // Track acted-on IDs for optimistic removal
  const [actedIds, setActedIds] = useState<Set<string>>(new Set());

  const load = () => {
    setLoading(true);
    getPendingApprovals()
      .then((d) => { setApprovals(d.items); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEventStream(["agent", "safety"], (evt: SseEvent) => {
    if (
      evt.type.startsWith("agent.approval.") ||
      evt.type.startsWith("safety.")
    ) {
      load();
    }
  });

  const handleActed = (id: string) => {
    setActedIds((prev) => new Set([...prev, id]));
    // Refetch after short delay to let backend settle
    setTimeout(load, 600);
  };

  const visible = approvals.filter((a) => !actedIds.has(a.apv_id));

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Approvals"
        eyebrow="Agent OS"
        subtitle={
          loading
            ? "Loading..."
            : visible.length === 0
            ? "Nothing needs you."
            : `${visible.length} pending`
        }
      />

      {loading && (
        <div className="flex items-center justify-center h-40 text-muted text-sm">
          Loading...
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <div className="text-4xl mb-3">&#10003;</div>
          <h2 className="text-base font-semibold text-foreground mb-1">
            Nothing needs you.
          </h2>
          <p className="text-sm text-muted max-w-sm mx-auto">
            When an agent run requires human approval, the items will appear here.
          </p>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="space-y-3">
          {visible.map((apv) => (
            <ApprovalCard
              key={apv.apv_id}
              apv={apv}
              onGranted={() => handleActed(apv.apv_id)}
              onDenied={() => handleActed(apv.apv_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
