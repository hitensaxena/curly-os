import { spawn } from "node:child_process";
import { CHROMA_VENV_PYTHON, CLAUDE_CHAT_PY, VAULT } from "@/lib/paths";
import { ensureDataDir, getChat, recordTurn } from "@/lib/chats-db";
import { brain } from "@/lib/brain";

export const runtime = "nodejs";

// Brain /rag fan-in: parallel to mind's own retrieval, additive, failure-safe.
// Emits brain's hits as extra `retrieval` chunks; the client MERGES them with
// mind's (ChatWindow appends). Brain being down/slow never affects the chat.
async function fanInBrainRag(
  question: string,
  send: (event: string, data: unknown) => void,
) {
  try {
    const rag = await brain.rag(question, 6);
    const chunks = rag.hits.map((h) => {
      const p = (h.metadata as { path?: unknown })?.path;
      return {
        path: typeof p === "string" ? p : h.id,
        title: `🧠 ${h.title ?? h.id}`,
        distance:
          typeof h._score === "number" ? Number((1 - h._score).toFixed(3)) : null,
      };
    });
    if (chunks.length) send("retrieval", { chunks });
  } catch {
    // brain is an optional enhancement; the chat works without it.
  }
}

// In-flight session ids in this worker. A second request for the same id
// (e.g. two tabs on the same /chat/<id>) returns 409 instead of racing
// recordTurn() and interleaving message rows.
const inFlightSessions = new Set<string>();

type ChatRequest = {
  question?: unknown;
  sessionId?: unknown;
  think?: unknown;
};

// Budget handed to claude via MAX_THINKING_TOKENS when the user flips the
// "Think harder" toggle. The claude binary reads this env var to enable
// extended thinking; it inherits node → python → claude.
const THINKING_BUDGET = "10000";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ChatRequest;
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const think = body.think === true;
  const reqSessionId =
    typeof body.sessionId === "string" && body.sessionId.length > 0
      ? body.sessionId
      : null;

  if (!question) {
    return new Response("question required", { status: 400 });
  }

  // Resume only if we have a record of this id — the client-minted uuid for
  // a brand-new tab won't be in the DB, so we let claude start fresh and
  // mint its own session_id.
  const resumeId = reqSessionId && getChat(reqSessionId) ? reqSessionId : null;

  // Race guard: only the *known* (persisted) session id can collide between
  // tabs in a meaningful way. A brand-new tab's throwaway uuid is unique.
  if (resumeId && inFlightSessions.has(resumeId)) {
    return Response.json(
      { error: "session busy", message: "Another tab is replying — try again in a moment." },
      { status: 409 }
    );
  }
  if (resumeId) inFlightSessions.add(resumeId);

  const args = [CLAUDE_CHAT_PY, "--stream-json"];
  if (resumeId) args.push("--resume", resumeId);
  args.push(question);

  await ensureDataDir();

  const proc = spawn(CHROMA_VENV_PYTHON, args, {
    cwd: VAULT,
    stdio: ["ignore", "pipe", "pipe"],
    env: think
      ? { ...process.env, MAX_THINKING_TOKENS: THINKING_BUDGET }
      : process.env,
  });

  const encoder = new TextEncoder();
  let buffer = "";
  let assistantText = "";
  let sessionId: string | null = null;

  // Shared across start()/cancel(): once the client disconnects or the stream
  // ends, no handler may touch the controller again. Enqueuing/closing a closed
  // controller throws ERR_INVALID_STATE, and because that happens inside a
  // ChildProcess event handler it becomes an uncaughtException that kills the
  // whole server. The guards below make every controller op a safe no-op.
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed/cancelled */
        }
      };
      const sendEvent = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Consumer went away mid-stream: stop streaming and tear down the
          // child so we don't keep throwing on a dead controller.
          closed = true;
          try {
            proc.kill("SIGTERM");
          } catch {
            /* already exited */
          }
        }
      };

      // Fire brain retrieval in parallel — usually resolves long before claude
      // finishes, so its chunks land early alongside mind's own retrieval frame.
      void fanInBrainRag(question, sendEvent);

      proc.stdout.setEncoding("utf8");
      proc.stdout.on("data", (chunk: string) => {
        buffer += chunk;
        let newlineIdx;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line) continue;
          try {
            const event = JSON.parse(line);
            const captured = handleClaudeEvent(event, sendEvent);
            if (captured.deltaText) assistantText += captured.deltaText;
            if (captured.sessionId) {
              sessionId = captured.sessionId;
              // Lock the real id too, so a sibling tab arriving mid-stream
              // can't squeeze a request through before we recordTurn.
              inFlightSessions.add(captured.sessionId);
            }
            if (captured.finalResult) assistantText = captured.finalResult;
          } catch {
            // Non-JSON lines from python (e.g. startup messages); ignore.
          }
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        sendEvent("stderr", { text: chunk.toString("utf8") });
      });

      const releaseLock = () => {
        if (resumeId) inFlightSessions.delete(resumeId);
        if (sessionId && sessionId !== resumeId) inFlightSessions.delete(sessionId);
      };

      proc.on("error", (err) => {
        sendEvent("error", { message: err.message });
        releaseLock();
        safeClose();
      });

      proc.on("exit", (code) => {
        if (sessionId && assistantText) {
          try {
            recordTurn({ sessionId, question, assistant: assistantText });
          } catch (e) {
            console.error("[chat persist]", e);
          }
        }
        sendEvent("end", { exitCode: code, chatId: sessionId });
        releaseLock();
        safeClose();
      });
    },
    cancel() {
      // Client disconnected — mark closed so in-flight child handlers stop
      // enqueuing, then tear down the child process.
      closed = true;
      try {
        proc.kill("SIGTERM");
      } catch {
        /* already exited */
      }
      if (resumeId) inFlightSessions.delete(resumeId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

type Captured = {
  deltaText?: string;
  sessionId?: string;
  finalResult?: string;
};

function handleClaudeEvent(
  event: Record<string, unknown>,
  send: (eventName: string, data: unknown) => void
): Captured {
  // Retrieval frame emitted by claude_chat.py before claude itself starts.
  if (event.type === "retrieval") {
    send("retrieval", { chunks: event.chunks });
    return {};
  }
  // A full assistant turn — its content[] carries completed tool_use blocks
  // with full input, which we turn into readable activity rows ("Reading X").
  if (event.type === "assistant") {
    const message = event.message as Record<string, unknown> | undefined;
    const content = message?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block && typeof block === "object") {
          const b = block as Record<string, unknown>;
          if (b.type === "tool_use" && typeof b.name === "string") {
            send("activity", {
              tool: b.name,
              label: toolLabel(b.name, b.input),
            });
          }
        }
      }
    }
    return {};
  }
  // Token-level streaming deltas — what the UI types out in real time.
  if (event.type === "stream_event") {
    const inner = event.event as Record<string, unknown> | undefined;
    // Block boundaries drive the coarse phase indicator (thinking / working /
    // writing) so the loader can say what claude is actually doing right now.
    if (inner?.type === "content_block_start") {
      const block = inner.content_block as Record<string, unknown> | undefined;
      if (block?.type === "thinking") send("phase", { phase: "thinking" });
      else if (block?.type === "tool_use") send("phase", { phase: "working" });
      else if (block?.type === "text") send("phase", { phase: "writing" });
      return {};
    }
    if (inner?.type === "content_block_delta") {
      const delta = inner.delta as Record<string, unknown> | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        send("delta", { text: delta.text });
        return { deltaText: delta.text };
      }
      // Extended-thinking deltas — streamed into a collapsible reasoning panel.
      if (delta?.type === "thinking_delta" && typeof delta.thinking === "string") {
        send("thinking", { text: delta.thinking });
      }
    }
    return {};
  }
  // Final result — carries the canonical full text and usage/cost.
  if (event.type === "result") {
    send("result", {
      result: event.result,
      sessionId: event.session_id,
      durationMs: event.duration_ms,
      ttftMs: event.ttft_ms,
      isError: event.is_error,
      totalCostUsd: event.total_cost_usd,
    });
    return {
      sessionId: typeof event.session_id === "string" ? event.session_id : undefined,
      finalResult: typeof event.result === "string" ? event.result : undefined,
    };
  }
  return {};
}

// Turn a tool_use block into a short human-readable activity label for the
// "what claude is doing" timeline. Falls back to the raw tool name.
function toolLabel(name: string, input: unknown): string {
  const inp = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof inp[k] === "string" ? (inp[k] as string) : "");
  const base = (p: string) => p.split("/").filter(Boolean).pop() || p;
  switch (name) {
    case "Read":
      return str("file_path") ? `Reading ${base(str("file_path"))}` : "Reading a file";
    case "Edit":
    case "Write":
      return str("file_path") ? `Editing ${base(str("file_path"))}` : "Editing a file";
    case "Grep": {
      const p = str("pattern");
      return p ? `Searching for “${p}”` : "Searching the vault";
    }
    case "Glob":
      return str("pattern") ? `Finding ${str("pattern")}` : "Finding files";
    case "Bash":
      return "Running a command";
    case "WebFetch":
    case "WebSearch": {
      const q = str("url") || str("query");
      try {
        return q ? `Fetching ${new URL(q).host}` : "Searching the web";
      } catch {
        return q ? `Searching “${q}”` : "Searching the web";
      }
    }
    case "Task":
      return "Delegating to a subagent";
    default:
      return name;
  }
}
