"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatMessage, type Activity, type Phase, type RetrievalChunk } from "./ChatMessage";
import { streamChat } from "@/lib/use-chat-stream";
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
  const abortRef = useRef<{ cancel: () => void } | null>(null);
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

  const send = () => {
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
    const asstId = asstMsg.id;
    const update = (fn: (msg: Message) => Message) =>
      setMessages((m) => m.map((msg) => (msg.id === asstId ? fn(msg) : msg)));

    // Shared SSE consumer (lib/use-chat-stream) — the same parser the command
    // bar's "Ask Curly" mode uses. Behavior here is unchanged from the inline
    // version it replaced.
    abortRef.current = streamChat(
      { question: q, sessionId: sessionIdRef.current, think },
      {
        onRetrieval: (chunks) =>
          update((msg) => ({ ...msg, retrieval: [...(msg.retrieval ?? []), ...chunks] })),
        onActivity: (a) =>
          update((msg) => ({ ...msg, activities: [...(msg.activities ?? []), a] })),
        onPhase: (phase) => update((msg) => ({ ...msg, phase })),
        onThinking: (text) =>
          update((msg) => ({
            ...msg,
            thinking: (msg.thinking ?? "") + text,
            phase: "thinking",
          })),
        onDelta: (text) =>
          update((msg) => ({ ...msg, content: msg.content + text, phase: "writing" })),
        onResult: (r) => {
          update((msg) => ({ ...msg, ...(r.result ? { content: r.result } : {}), phase: "done" }));
          // Reconcile URL with claude's real session id (first turn only).
          if (r.sessionId && r.sessionId !== sessionIdRef.current) {
            sessionIdRef.current = r.sessionId;
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", `/chat/${r.sessionId}`);
            }
          }
        },
        onError: (message) =>
          update((msg) => ({ ...msg, error: message || "stream failed", streaming: false })),
        onClose: () => {
          setIsStreaming(false);
          abortRef.current = null;
          update((msg) => ({ ...msg, streaming: false, phase: "done" }));
        },
      },
    );
  };

  const newConversation = () => {
    abortRef.current?.cancel();
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
      <div className="border-t border-border/50 bg-surface/70 px-3 py-3 backdrop-blur-xl sm:px-4">
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
