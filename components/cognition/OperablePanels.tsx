"use client";

// The actionable half of the cognition layer. Each panel reads one collection
// and offers the one or two writes the core supports for it — until now these
// five endpoints had no UI at all, so proposals could only be resolved by curl.

import { useCallback, useEffect, useState } from "react";

const API = "";

async function call(path: string, method: "GET" | "POST" | "DELETE", body?: unknown) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) {
    const detail = await r.json().catch(() => ({}));
    throw new Error(detail?.detail ? String(detail.detail) : `HTTP ${r.status}`);
  }
  return r.json();
}

function Shell({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-foreground mb-1">{title}</h2>
      <p className="text-xs text-muted mb-2">{hint}</p>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">{children}</div>
  );
}

function Action({
  onClick,
  children,
  busy,
}: {
  onClick: () => void;
  children: React.ReactNode;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded border border-border px-2 py-0.5 text-[11px] text-muted transition-colors hover:border-accent hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null;
}

// --- working set -------------------------------------------------------------

export function WorkingSetPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await call("/api/cognition/working-set?limit=30", "GET");
      setItems(d.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, pinned: boolean) {
    setBusy(id);
    try {
      if (pinned) {
        await call(`/api/cognition/working-set/${encodeURIComponent(id)}`, "DELETE");
      } else {
        await call(`/api/cognition/working-set/${encodeURIComponent(id)}/pin`, "POST", {
          reason: "pinned from the webapp",
        });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell
      title="Working set"
      hint="Ranked by salience; members get a recall boost. Pinned entries survive refreshes."
    >
      <div className="space-y-2">
        {items.map((item) => (
          <Row key={item.memory_id}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-foreground">{item.statement ?? item.memory_id}</p>
                <p className="mt-0.5 text-[10px] text-muted">
                  salience {Number(item.salience ?? 0).toFixed(2)}
                  {item.pinned ? " · pinned" : ""}
                </p>
              </div>
              <Action busy={busy === item.memory_id} onClick={() => act(item.memory_id, !!item.pinned)}>
                {item.pinned ? "unpin" : "pin"}
              </Action>
            </div>
          </Row>
        ))}
        {items.length === 0 && <Empty>Nothing in the working set yet.</Empty>}
      </div>
      <ErrorLine error={error} />
    </Shell>
  );
}

// --- contradictions ----------------------------------------------------------

const RESOLUTIONS: { action: string; label: string }[] = [
  { action: "keep_both", label: "keep both" },
  { action: "supersede_left", label: "drop left" },
  { action: "supersede_right", label: "drop right" },
  { action: "dismiss", label: "dismiss" },
];

export function ContradictionsPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await call("/api/cognition/contradictions?status=open", "GET");
      setItems(d.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(id: string, action: string) {
    setBusy(id);
    try {
      await call(`/api/cognition/contradictions/${encodeURIComponent(id)}/resolve`, "POST", {
        action,
        resolved_by: "webapp",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell
      title="Contradictions"
      hint="Pairs the scan thinks disagree. Nothing changes until you choose."
    >
      <div className="space-y-2">
        {items.map((item) => (
          <Row key={item.id}>
            <div className="grid gap-1 sm:grid-cols-2">
              <p className="text-sm text-foreground">{item.left_statement ?? item.left_text ?? "—"}</p>
              <p className="text-sm text-foreground">{item.right_statement ?? item.right_text ?? "—"}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {RESOLUTIONS.map((r) => (
                <Action key={r.action} busy={busy === item.id} onClick={() => resolve(item.id, r.action)}>
                  {r.label}
                </Action>
              ))}
              {item.similarity != null && (
                <span className="text-[10px] text-muted">sim {Number(item.similarity).toFixed(2)}</span>
              )}
            </div>
          </Row>
        ))}
        {items.length === 0 && <Empty>No open contradictions.</Empty>}
      </div>
      <ErrorLine error={error} />
    </Shell>
  );
}

// --- intentions --------------------------------------------------------------

export function IntentionsPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await call("/api/cognition/intentions", "GET");
      setItems(d.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, verb: "complete" | "dismiss" | "snooze") {
    setBusy(id);
    try {
      const body =
        verb === "snooze"
          ? { until: new Date(Date.now() + 86_400_000).toISOString() }
          : undefined;
      await call(`/api/cognition/intentions/${encodeURIComponent(id)}/${verb}`, "POST", body);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell
      title="Intentions"
      hint="Things you said you would revisit. Snooze pushes one out by a day."
    >
      <div className="space-y-2">
        {items.map((item) => (
          <Row key={item.id}>
            <p className="text-sm text-foreground">{item.title ?? item.text ?? item.id}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted">
                {item.status}
                {item.due_at ? ` · due ${new Date(item.due_at).toLocaleDateString()}` : ""}
              </span>
              <Action busy={busy === item.id} onClick={() => act(item.id, "complete")}>done</Action>
              <Action busy={busy === item.id} onClick={() => act(item.id, "snooze")}>snooze 1d</Action>
              <Action busy={busy === item.id} onClick={() => act(item.id, "dismiss")}>dismiss</Action>
            </div>
          </Row>
        ))}
        {items.length === 0 && <Empty>No open intentions.</Empty>}
      </div>
      <ErrorLine error={error} />
    </Shell>
  );
}

// --- curiosity ---------------------------------------------------------------

export function CuriosityPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const d = await call("/api/cognition/curiosity?status=open", "GET");
      setItems(d.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, verb: "answer" | "dismiss") {
    setBusy(id);
    try {
      await call(
        `/api/cognition/curiosity/${encodeURIComponent(id)}/${verb}`,
        "POST",
        verb === "answer" ? { note: note[id] ?? "" } : undefined,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell
      title="Curiosity"
      hint="Questions the system can ground but cannot answer from what it holds."
    >
      <div className="space-y-2">
        {items.map((item) => (
          <Row key={item.id}>
            <p className="text-sm text-foreground">{item.question ?? item.text ?? item.id}</p>
            {item.rationale && <p className="mt-0.5 text-[11px] text-muted">{item.rationale}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <input
                value={note[item.id] ?? ""}
                onChange={(e) => setNote((prev) => ({ ...prev, [item.id]: e.target.value }))}
                placeholder="answer in a sentence"
                className="w-56 rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none"
              />
              <Action busy={busy === item.id} onClick={() => act(item.id, "answer")}>answer</Action>
              <Action busy={busy === item.id} onClick={() => act(item.id, "dismiss")}>dismiss</Action>
            </div>
          </Row>
        ))}
        {items.length === 0 && <Empty>No open questions.</Empty>}
      </div>
      <ErrorLine error={error} />
    </Shell>
  );
}
