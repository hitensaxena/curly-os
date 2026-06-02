// Shared SSE consumer for POST /api/chat. Extracted from ChatWindow so the full
// chat view AND the command-bar "Ask Curly" mode parse the EXACT same stream.
// The server (app/api/chat/route.ts) emits SSE frames separated by blank lines:
//   event: retrieval|activity|phase|thinking|delta|result|error|stderr|end
// We split on "\n\n" and dispatch typed handlers. Browser-only (fetch/streams).

export type StreamPhase = "retrieving" | "thinking" | "working" | "writing" | "done";
export type StreamActivity = { tool: string; label: string };
export type StreamChunk = { path: string; title: string; distance: number | null };
export type StreamResult = {
  result?: string;
  sessionId?: string;
  durationMs?: number;
  ttftMs?: number;
  isError?: boolean;
  totalCostUsd?: number;
};

export type ChatStreamHandlers = {
  onRetrieval?: (chunks: StreamChunk[]) => void;
  onActivity?: (a: StreamActivity) => void;
  onPhase?: (phase: StreamPhase) => void;
  onThinking?: (text: string) => void;
  onDelta?: (text: string) => void;
  onResult?: (r: StreamResult) => void;
  onError?: (message: string) => void;
  onStderr?: (text: string) => void;
  onEnd?: (e: { exitCode?: number | null; chatId?: string | null }) => void;
  // Fires exactly once when the stream finishes (completed, errored, or
  // cancelled). Use it to clear "streaming" UI state.
  onClose?: () => void;
};

export type ChatStreamBody = {
  question: string;
  sessionId: string | null;
  think?: boolean;
};

const PHASES = new Set(["retrieving", "thinking", "working", "writing", "done"]);

function dispatchFrame(frame: string, h: ChatStreamHandlers) {
  const lines = frame.split("\n");
  let eventName = "message";
  let dataRaw = "";
  for (const line of lines) {
    if (line.startsWith("event: ")) eventName = line.slice(7).trim();
    else if (line.startsWith("data: ")) dataRaw += line.slice(6);
  }
  if (!dataRaw) return;
  let data: unknown;
  try {
    data = JSON.parse(dataRaw);
  } catch {
    return;
  }
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  switch (eventName) {
    case "delta":
      if (typeof o.text === "string") h.onDelta?.(o.text);
      break;
    case "thinking":
      if (typeof o.text === "string") h.onThinking?.(o.text);
      break;
    case "phase":
      if (typeof o.phase === "string" && PHASES.has(o.phase)) h.onPhase?.(o.phase as StreamPhase);
      break;
    case "activity": {
      const tool = typeof o.tool === "string" ? o.tool : "";
      const label = typeof o.label === "string" ? o.label : tool;
      if (label) h.onActivity?.({ tool, label });
      break;
    }
    case "retrieval": {
      const chunks = Array.isArray(o.chunks) ? o.chunks : [];
      const normalized: StreamChunk[] = chunks
        .map((c) => {
          if (!c || typeof c !== "object") return null;
          const x = c as Record<string, unknown>;
          return {
            path: typeof x.path === "string" ? x.path : "",
            title: typeof x.title === "string" ? x.title : "",
            distance: typeof x.distance === "number" ? x.distance : null,
          };
        })
        .filter((c): c is StreamChunk => c !== null);
      if (normalized.length) h.onRetrieval?.(normalized);
      break;
    }
    case "result":
      h.onResult?.({
        result: typeof o.result === "string" ? o.result : undefined,
        sessionId: typeof o.sessionId === "string" ? o.sessionId : undefined,
        durationMs: typeof o.durationMs === "number" ? o.durationMs : undefined,
        ttftMs: typeof o.ttftMs === "number" ? o.ttftMs : undefined,
        isError: typeof o.isError === "boolean" ? o.isError : undefined,
        totalCostUsd: typeof o.totalCostUsd === "number" ? o.totalCostUsd : undefined,
      });
      break;
    case "error":
      h.onError?.(typeof o.message === "string" ? o.message : "stream error");
      break;
    case "stderr":
      if (typeof o.text === "string") h.onStderr?.(o.text);
      break;
    case "end":
      h.onEnd?.({
        exitCode: typeof o.exitCode === "number" ? o.exitCode : null,
        chatId: typeof o.chatId === "string" ? o.chatId : null,
      });
      break;
  }
}

// Start a chat stream. Returns { cancel } to abort (client disconnect). The
// route guards its controller, so cancelling mid-stream is safe server-side.
export function streamChat(body: ChatStreamBody, handlers: ChatStreamHandlers): { cancel: () => void } {
  const controller = new AbortController();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    handlers.onClose?.();
  };
  (async () => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.status === 409) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        handlers.onError?.(d.message ?? "Another tab is replying — try again in a moment.");
        return;
      }
      if (!res.ok || !res.body) {
        handlers.onError?.(`chat api ${res.status}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          dispatchFrame(frame, handlers);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      handlers.onError?.(err instanceof Error ? err.message : String(err));
    } finally {
      close();
    }
  })();
  return { cancel: () => controller.abort() };
}
