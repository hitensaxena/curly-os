"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatMessage, type Activity, type Phase, type RetrievalChunk } from "./ChatMessage";
import { useVoiceInput } from "@/lib/use-voice-input";
import { VoicePrivacyNotice } from "@/components/VoicePrivacyNotice";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
  streaming?: boolean;
  error?: string;
  retrieval?: RetrievalChunk[];
  thinking?: string;
  activities?: Activity[];
  phase?: Phase;
};

const THINK_PREF_KEY = "crazymage:chat:think";

type InitialMessage = { role: Role; content: string };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function ChatWindow({
  sessionId: initialSessionId,
  initialMessages,
  chatExists = false,
}: {
  sessionId: string;
  initialMessages: InitialMessage[];
  chatExists?: boolean;
}) {
  const router = useRouter();
  // Local mutable session id — starts as the URL-minted uuid, gets swapped
  // to claude's real session_id after the first server response.
  const sessionIdRef = useRef(initialSessionId);
  const [messages, setMessages] = useState<Message[]>(() =>
    initialMessages.map((m) => ({ id: uid(), role: m.role, content: m.content }))
  );
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [think, setThink] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const voice = useVoiceInput({ value: input, onChange: setInput });

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages]);

  // Restore the "Think harder" preference once on mount. Read in an effect
  // (not a lazy initializer) to avoid an SSR/client hydration mismatch.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(THINK_PREF_KEY) === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThink(true);
    }
  }, []);

  const toggleThink = () => {
    setThink((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THINK_PREF_KEY, next ? "1" : "0");
      }
      return next;
    });
  };

  // If the URL id changes (user navigated to a different chat), reset state
  // via the "store info from prior render" pattern so React 19 strict mode
  // doesn't flag the prop-driven setState as set-state-in-effect.
  const [prevSessionId, setPrevSessionId] = useState(initialSessionId);
  if (prevSessionId !== initialSessionId) {
    setPrevSessionId(initialSessionId);
    setMessages(
      initialMessages.map((m) => ({ id: uid(), role: m.role, content: m.content })),
    );
  }
  // Keep the mutable ref in sync via an effect (ref writes during render
  // would be flagged by react-hooks/refs).
  useEffect(() => {
    sessionIdRef.current = initialSessionId;
  }, [initialSessionId]);

  const handleFrame = (frame: string, asstId: string) => {
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
    if (eventName === "delta" && data && typeof data === "object" && "text" in data) {
      const text = String((data as { text: unknown }).text ?? "");
      setMessages((m) =>
        m.map((msg) =>
          msg.id === asstId
            ? { ...msg, content: msg.content + text, phase: "writing" }
            : msg,
        ),
      );
    } else if (eventName === "thinking" && data && typeof data === "object" && "text" in data) {
      const text = String((data as { text: unknown }).text ?? "");
      setMessages((m) =>
        m.map((msg) =>
          msg.id === asstId
            ? { ...msg, thinking: (msg.thinking ?? "") + text, phase: "thinking" }
            : msg,
        ),
      );
    } else if (eventName === "phase" && data && typeof data === "object") {
      const phase = (data as { phase?: unknown }).phase;
      if (phase === "thinking" || phase === "working" || phase === "writing") {
        setMessages((m) =>
          m.map((msg) => (msg.id === asstId ? { ...msg, phase } : msg)),
        );
      }
    } else if (eventName === "activity" && data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      const tool = typeof obj.tool === "string" ? obj.tool : "";
      const label = typeof obj.label === "string" ? obj.label : tool;
      if (label) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === asstId
              ? { ...msg, activities: [...(msg.activities ?? []), { tool, label }] }
              : msg,
          ),
        );
      }
    } else if (eventName === "retrieval" && data && typeof data === "object") {
      const chunks = (data as { chunks?: unknown }).chunks;
      if (Array.isArray(chunks)) {
        const normalized: RetrievalChunk[] = chunks
          .map((c) => {
            if (!c || typeof c !== "object") return null;
            const obj = c as Record<string, unknown>;
            return {
              path: typeof obj.path === "string" ? obj.path : "",
              title: typeof obj.title === "string" ? obj.title : "",
              distance: typeof obj.distance === "number" ? obj.distance : null,
            };
          })
          .filter((c): c is RetrievalChunk => c !== null);
        setMessages((m) =>
          m.map((msg) =>
            msg.id === asstId
              ? { ...msg, retrieval: [...(msg.retrieval ?? []), ...normalized] }
              : msg,
          ),
        );
      }
    } else if (eventName === "result" && data && typeof data === "object") {
      const result = (data as { result?: unknown }).result;
      const claudeSessionId = (data as { sessionId?: unknown }).sessionId;
      if (typeof result === "string" && result) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === asstId ? { ...msg, content: result, phase: "done" } : msg,
          ),
        );
      } else {
        setMessages((m) =>
          m.map((msg) => (msg.id === asstId ? { ...msg, phase: "done" } : msg)),
        );
      }
      // Reconcile URL with claude's real session id (only on first turn,
      // when our client-minted uuid doesn't match what claude returned).
      if (
        typeof claudeSessionId === "string" &&
        claudeSessionId &&
        claudeSessionId !== sessionIdRef.current
      ) {
        sessionIdRef.current = claudeSessionId;
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `/chat/${claudeSessionId}`);
        }
      }
    } else if (eventName === "error" && data && typeof data === "object") {
      const message = String((data as { message?: unknown }).message ?? "stream error");
      setMessages((m) =>
        m.map((msg) => (msg.id === asstId ? { ...msg, error: message, streaming: false } : msg)),
      );
    }
  };

  const send = async () => {
    const q = input.trim();
    if (!q || isStreaming) return;

    setInput("");
    const userMsg: Message = { id: uid(), role: "user", content: q };
    const asstMsg: Message = {
      id: uid(),
      role: "assistant",
      content: "",
      streaming: true,
      phase: "retrieving",
    };
    setMessages((m) => [...m, userMsg, asstMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, sessionId: sessionIdRef.current, think }),
        signal: controller.signal,
      });
      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(
          data.message ?? "Another tab is replying — try again in a moment."
        );
      }
      if (!res.ok || !res.body) {
        throw new Error(`chat api ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE frames are separated by blank lines.
        let sep;
        while ((sep = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          handleFrame(frame, asstMsg.id);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === asstMsg.id
            ? { ...msg, streaming: false, error: message || "stream failed" }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      setMessages((m) =>
        m.map((msg) =>
          msg.id === asstMsg.id ? { ...msg, streaming: false, phase: "done" } : msg,
        ),
      );
    }
  };

  const newConversation = () => {
    abortRef.current?.abort();
    router.push("/chat");
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.length === 0 && (
            <EmptyState
              logoSize="lg"
              title={chatExists ? "Ask the vault anything" : "New conversation"}
              body={
                chatExists
                  ? "Each turn re-queries Chroma for fresh context."
                  : "No chat exists at this URL yet — type below to start one. The URL will update to a permanent session id after Claude replies."
              }
            />
          )}
          {messages.map((m) => (
            <ChatMessage
              key={m.id}
              role={m.role}
              content={m.content}
              streaming={m.streaming}
              error={m.error}
              retrieval={m.retrieval}
              thinking={m.thinking}
              activities={m.activities}
              phase={m.phase}
            />
          ))}
        </div>
      </div>
      <div className="border-t border-border bg-surface px-3 py-3 sm:px-4">
        <div className="mx-auto max-w-3xl">
          {voice.showPrivacyNotice && (
            <div className="mb-2">
              <VoicePrivacyNotice
                onContinue={voice.acknowledgePrivacyAndRecord}
                onCancel={voice.dismissPrivacyNotice}
              />
            </div>
          )}
          {voice.voiceError && (
            <p className="mb-1 text-xs text-danger">
              {voice.voiceError}
            </p>
          )}
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask the vault…"
              rows={1}
              className="min-h-11 w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent sm:flex-1"
              disabled={isStreaming}
            />
            <div className="flex items-end justify-end gap-2">
              <button
                type="button"
                onClick={toggleThink}
                aria-pressed={think}
                title={
                  think
                    ? "Extended thinking on — Claude reasons before replying"
                    : "Turn on extended thinking"
                }
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
                  think
                    ? "bg-accent/15 text-accent ring-1 ring-accent/40"
                    : "border border-border bg-surface text-muted hover:bg-surface-2"
                }`}
              >
                <span aria-hidden>✦</span>
                Think
              </button>
              {voice.supported && (
                <button
                  type="button"
                  onClick={voice.toggleRecording}
                  disabled={isStreaming}
                  title={voice.recording ? "Stop dictation" : "Start dictation"}
                  aria-label={voice.recording ? "Stop dictation" : "Start dictation"}
                  className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-base leading-none transition-colors disabled:opacity-40 ${
                    voice.recording
                      ? "bg-danger text-white animate-pulse"
                      : "border border-border bg-surface text-foreground hover:bg-surface-2"
                  }`}
                >
                  {voice.recording ? "■" : "🎙"}
                </button>
              )}
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!input.trim() || isStreaming}
              >
                {isStreaming ? "…" : "Send"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={newConversation}
                title="Start a new conversation thread"
              >
                New
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
