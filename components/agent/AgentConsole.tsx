"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useVoiceInput } from "@/lib/use-voice-input";
import { VoicePrivacyNotice } from "@/components/VoicePrivacyNotice";
import { Markdown } from "@/components/Markdown";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { GroundedOn, type RetrievalChunk } from "@/components/chat/GroundedOn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeading } from "@/components/ui/PageHeading";
import { relTime } from "@/lib/format";

// The agent command center. A typed or spoken ask becomes a fresh /api/chat
// turn, grounded in long-term memory + vault notes. Each run shows what it was
// grounded on and is persisted (reopenable as a chat).
type Phase = "retrieving" | "thinking" | "working" | "writing" | "done";

type Run = {
  id: string;
  question: string;
  content: string;
  retrieval: RetrievalChunk[];
  phase?: Phase;
  error?: string;
  streaming: boolean;
  sessionId?: string;
  cost?: number;
  durationMs?: number;
  startedAt: number;
};

export type HistoryItem = {
  id: string;
  first_q: string;
  summary: string | null;
  message_count: number;
  started_at: number;
};

const EXAMPLES = [
  "What have I been thinking about this week?",
  "Summarize what I know about Mintrix.",
  "What are my stated priorities — and am I acting on them?",
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function phaseLabel(run: Run): { label: string; state: "loading" | "drafting" } {
  if (run.phase === "writing") return { label: "Writing…", state: "drafting" };
  return { label: "Recalling…", state: "loading" };
}

export function AgentConsole({
  history,
  initialTask = "",
}: {
  history: HistoryItem[];
  initialTask?: string;
}) {
  const [input, setInput] = useState(initialTask);
  const [think, setThink] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const voice = useVoiceInput({ value: input, onChange: setInput });
  const taRef = useRef<HTMLTextAreaElement>(null);

  function patch(id: string, fn: (r: Run) => Run) {
    setRuns((rs) => rs.map((r) => (r.id === id ? fn(r) : r)));
  }

  function handleFrame(frame: string, id: string) {
    let eventName = "message";
    let dataRaw = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event: ")) eventName = line.slice(7).trim();
      else if (line.startsWith("data: ")) dataRaw += line.slice(6);
    }
    if (!dataRaw) return;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(dataRaw);
    } catch {
      return;
    }
    switch (eventName) {
      case "delta":
        patch(id, (r) => ({ ...r, content: r.content + String(data.text ?? ""), phase: "writing" }));
        break;
      case "phase":
        if (data.phase === "writing") patch(id, (r) => ({ ...r, phase: "writing" }));
        break;
      case "retrieval": {
        const raw = Array.isArray(data.chunks) ? data.chunks : [];
        const chunks = raw
          .map((c) => {
            if (!c || typeof c !== "object") return null;
            const x = c as Record<string, unknown>;
            const kind =
              x.kind === "memory" || x.kind === "note" || x.kind === "identity" ? x.kind : undefined;
            return {
              kind,
              path: typeof x.path === "string" ? x.path : "",
              title: typeof x.title === "string" ? x.title : "",
              distance: typeof x.distance === "number" ? x.distance : null,
            } as RetrievalChunk;
          })
          .filter((c): c is RetrievalChunk => c !== null);
        if (chunks.length) patch(id, (r) => ({ ...r, retrieval: [...r.retrieval, ...chunks] }));
        break;
      }
      case "result": {
        const result = typeof data.result === "string" ? data.result : "";
        patch(id, (r) => ({
          ...r,
          content: result || r.content,
          phase: "done",
          sessionId: typeof data.sessionId === "string" ? data.sessionId : r.sessionId,
          cost: typeof data.totalCostUsd === "number" ? data.totalCostUsd : r.cost,
          durationMs: typeof data.durationMs === "number" ? data.durationMs : r.durationMs,
        }));
        break;
      }
      case "error":
        patch(id, (r) => ({ ...r, error: String(data.message ?? "error"), streaming: false }));
        break;
    }
  }

  async function run() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    const id = uid();
    const fresh: Run = {
      id,
      question: q,
      content: "",
      retrieval: [],
      phase: "retrieving",
      streaming: true,
      startedAt: Date.now(),
    };
    setRuns((rs) => [fresh, ...rs]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, sessionId: null, think }),
      });
      if (!res.ok || !res.body) throw new Error(`agent api ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buf.indexOf("\n\n")) !== -1) {
          handleFrame(buf.slice(0, sep), id);
          buf = buf.slice(sep + 2);
        }
      }
    } catch (e) {
      patch(id, (r) => ({ ...r, error: e instanceof Error ? e.message : "run failed" }));
    } finally {
      patch(id, (r) => ({ ...r, streaming: false, phase: "done" }));
      setBusy(false);
      taRef.current?.focus();
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Agent"
        subtitle="Ask Curly to reason over your long-term memory and notes. Each run shows what it was grounded on and is reopenable as a chat."
      />

      {/* Command bar */}
      <div className="rounded-lg border border-border bg-surface p-3">
        {voice.showPrivacyNotice && (
          <div className="mb-2">
            <VoicePrivacyNotice
              onContinue={voice.acknowledgePrivacyAndRecord}
              onCancel={voice.dismissPrivacyNotice}
            />
          </div>
        )}
        {voice.voiceError && <p className="mb-1 text-xs text-danger">{voice.voiceError}</p>}
        <textarea
          ref={taRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void run();
            }
          }}
          rows={2}
          placeholder="Tell Curly what to do…  (⌘↵ to run)"
          className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          disabled={busy}
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setThink((t) => !t)}
            aria-pressed={think}
            title="Extended thinking — Curly reasons more before acting"
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
              think
                ? "bg-accent/15 text-accent ring-1 ring-accent/40"
                : "border border-border bg-surface text-muted hover:bg-surface-2"
            }`}
          >
            <span aria-hidden>✦</span> Think
          </button>
          {voice.supported && (
            <button
              type="button"
              onClick={voice.toggleRecording}
              disabled={busy}
              title={voice.recording ? "Stop dictation" : "Dictate the task"}
              className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-base leading-none transition-colors disabled:opacity-40 ${
                voice.recording
                  ? "animate-pulse bg-danger text-white"
                  : "border border-border bg-surface text-foreground hover:bg-surface-2"
              }`}
            >
              {voice.recording ? "■" : "🎙"}
            </button>
          )}
          <Button size="sm" className="ml-auto" onClick={() => void run()} disabled={busy || !input.trim()}>
            {busy ? "Running…" : "Run"}
          </Button>
        </div>
      </div>

      {/* Live runs */}
      {runs.length === 0 && history.length === 0 && (
        <EmptyState
          className="mt-10"
          title="Nothing run yet"
          body="Try one of these, or describe your own task."
          action={
            <div className="flex flex-col gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setInput(ex)}
                  className="rounded-md border border-border bg-surface px-3 py-1.5 text-left text-xs text-subtle hover:bg-surface-2"
                >
                  {ex}
                </button>
              ))}
            </div>
          }
        />
      )}

      <div className="mt-5 space-y-4">
        {runs.map((r) => (
          <RunCard key={r.id} run={r} />
        ))}
      </div>

      {/* History */}
      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">Recent runs</h2>
          <div className="space-y-2">
            {history.map((h) => (
              <Card key={h.id} as={Link} href={`/chat/${h.id}`} interactive>
                <div className="truncate text-sm text-foreground">{h.summary || h.first_q}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {h.message_count} msg · {relTime(h.started_at)}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RunCard({ run }: { run: Run }) {
  const waiting = run.streaming && !run.content;
  const { label, state } = phaseLabel(run);
  return (
    <Card padding="loose">
      <div className="mb-2 text-sm font-medium text-foreground">{run.question}</div>

      {run.retrieval.length > 0 && (
        <div className="mb-2">
          <GroundedOn chunks={run.retrieval} />
        </div>
      )}

      {waiting && (
        <div className="flex items-center gap-2 py-1 text-xs text-muted">
          <AnimatedLogo state={state} size="sm" />
          <span>{label}</span>
        </div>
      )}

      {run.content && (
        <div className="rounded-md bg-surface-2 px-4 py-3">
          <Markdown>{run.content}</Markdown>
        </div>
      )}

      {run.error && <p className="mt-2 text-xs text-danger">⚠ {run.error}</p>}

      {!run.streaming && (run.sessionId || run.durationMs != null) && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
          {run.durationMs != null && <span>{(run.durationMs / 1000).toFixed(1)}s</span>}
          {run.cost != null && <span>${run.cost.toFixed(4)}</span>}
          {run.sessionId && (
            <Link href={`/chat/${run.sessionId}`} className="text-accent hover:underline">
              open as chat →
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}
