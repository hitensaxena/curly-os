"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { orchestratorChat, getOrchestratorMessages } from "@/lib/curlyos";
import { useEventStream } from "@/lib/use-event-stream";
import type { OrchestratorMessage, SseEvent } from "@/lib/curlyos-types";

/**
 * The project's conversation with the orchestrator. Anchored to the project's
 * primary goal (north-star, or the first goal) so commands like "plan it",
 * "approve", "start", "how's it going" act on the project's main thread.
 */
export function ProjectChat({ anchorGoalId }: { anchorGoalId: string | null }) {
  const [messages, setMessages] = useState<OrchestratorMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reload = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    if (!anchorGoalId) return;
    getOrchestratorMessages(anchorGoalId).then((d) => setMessages(d.items)).catch(() => {});
  }, [anchorGoalId]);

  useEffect(() => { load(); }, [load]);

  useEventStream(["agent", "goal"], (_e: SseEvent) => {
    if (reload.current) clearTimeout(reload.current);
    reload.current = setTimeout(load, 800);
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || sending || !anchorGoalId) return;
    setSending(true);
    setMessages((m) => [...m, { id: `tmp${m.length}`, role: "user", content: msg, meta: {}, created_at: new Date().toISOString() }]);
    setInput("");
    try { await orchestratorChat(msg, anchorGoalId); load(); }
    catch { setMessages((m) => [...m, { id: `e${m.length}`, role: "orchestrator", content: "That failed — try again.", meta: {}, created_at: null }]); }
    finally { setSending(false); }
  };

  return (
    <div className="flex h-[460px] flex-col rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-2.5">
        <p className="text-xs font-semibold text-foreground">Project chat</p>
        <p className="text-[11px] text-muted">Steer the orchestrator across this project&rsquo;s goals.</p>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {!anchorGoalId ? (
          <p className="text-xs text-muted">Add a goal to this project to start a conversation.</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted">
            Talk to the orchestrator about this project — &ldquo;plan the case study&rdquo;,
            &ldquo;what&rsquo;s left?&rdquo;, &ldquo;execute&rdquo;.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
              m.role === "user" ? "ml-auto bg-accent/15 text-foreground" : "bg-surface-2 text-foreground"
            }`}>
              {m.content}
              {typeof m.meta?.action === "string" && m.meta.action !== "none" && (
                <span className="mt-1 block font-mono text-[9px] text-muted">→ {m.meta.action}</span>
              )}
            </div>
          ))
        )}
        {sending && <p className="text-[10px] text-muted">orchestrator is thinking…</p>}
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={!anchorGoalId}
          placeholder="Message the orchestrator about this project…"
          className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <button onClick={send} disabled={sending || !input.trim() || !anchorGoalId}
          className="rounded bg-accent px-3 py-2 text-sm text-white hover:bg-accent/80 disabled:opacity-40">
          Send
        </button>
      </div>
    </div>
  );
}
