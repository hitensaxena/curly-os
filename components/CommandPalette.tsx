"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useVoice } from "@/lib/voice/VoiceContext";
import { useToast } from "@/components/ui/ToastProvider";
import { streamChat } from "@/lib/use-chat-stream";
import { Markdown } from "@/components/Markdown";
import type { SearchResponse } from "@/app/api/vault-search/route";

// The OS command bar. ⌘K (or the `curly-palette-open` event) summons it. Unlike
// the old launcher, it EXECUTES: typed prefixes route to real actions —
//   ?  ask Curly (streams an answer inline, hands off to /chat)
//   /  search your mind (live results)
//   +  capture to today's journal (or the current project)
//   !  run an agent task
//   (no prefix) blended navigate + search
// Voice (the orb) and this bar are the same Curly; this is the typed half.
type Mode = "default" | "ask" | "search" | "capture" | "run";

type NavItem = { id: string; label: string; hint: string; path: string };

// Every destination is reachable from the palette (the menu only lists the 6
// spaces). Spaces first, then every sub-surface, so ⌘K jumps anywhere directly.
const NAV: NavItem[] = [
  { id: "home", label: "Home", hint: "/", path: "/" },
  // spaces (hubs)
  { id: "talk", label: "Talk", hint: "/talk · converse", path: "/talk" },
  { id: "work", label: "Work", hint: "/work · goals & agents", path: "/work" },
  { id: "knowledge", label: "Knowledge", hint: "/knowledge · what Curly knows", path: "/knowledge" },
  { id: "create", label: "Create", hint: "/create · make & explore", path: "/create" },
  { id: "system", label: "System", hint: "/system · meta & health", path: "/system" },
  // Talk
  { id: "chat", label: "New chat with Curly", hint: "/chat", path: "/chat" },
  { id: "agent", label: "Agent command center", hint: "/agent", path: "/agent" },
  { id: "surface", label: "Voice surface", hint: "/surface", path: "/surface" },
  // Work
  { id: "goals", label: "Goals", hint: "/goals", path: "/goals" },
  { id: "orchestrator", label: "Orchestrator", hint: "/orchestrator", path: "/orchestrator" },
  { id: "jobs", label: "Jobs", hint: "/jobs", path: "/jobs" },
  { id: "inbox", label: "Inbox", hint: "/inbox", path: "/inbox" },
  { id: "runs", label: "Runs", hint: "/runs", path: "/runs" },
  { id: "approvals", label: "Approvals", hint: "/approvals", path: "/approvals" },
  { id: "opportunities", label: "Opportunities", hint: "/opportunities", path: "/opportunities" },
  // Knowledge
  { id: "memory", label: "Memory", hint: "/memory", path: "/memory" },
  { id: "episodes", label: "Episodes", hint: "/episodes", path: "/episodes" },
  { id: "graph", label: "Graph", hint: "/graph", path: "/graph" },
  { id: "self", label: "Self", hint: "/self", path: "/self" },
  { id: "identity", label: "Identity", hint: "/identity", path: "/identity" },
  { id: "notes", label: "Browse notes", hint: "/notes", path: "/notes" },
  { id: "journal", label: "Journal", hint: "/journal", path: "/journal" },
  { id: "search", label: "Search your mind", hint: "/search", path: "/search" },
  // Create
  { id: "studio", label: "Studio", hint: "/studio", path: "/studio" },
  { id: "simulation", label: "Simulation", hint: "/simulation", path: "/simulation" },
  { id: "decisions", label: "Decisions", hint: "/decisions", path: "/decisions" },
  { id: "projects", label: "Projects", hint: "/projects", path: "/projects" },
  { id: "workspaces", label: "Workspaces", hint: "/workspaces", path: "/workspaces" },
  // System
  { id: "cognition", label: "Cognition", hint: "/cognition", path: "/cognition" },
  { id: "evolution", label: "Evolution", hint: "/evolution", path: "/evolution" },
  { id: "systems", label: "Systems", hint: "/systems", path: "/systems" },
  { id: "logs", label: "Logs", hint: "/logs", path: "/logs" },
  { id: "care", label: "Self-care", hint: "/care", path: "/care" },
];

function parseQuery(raw: string): { mode: Mode; term: string } {
  if (raw.startsWith("?")) return { mode: "ask", term: raw.slice(1).trim() };
  if (raw.startsWith("/")) return { mode: "search", term: raw.slice(1).trim() };
  if (raw.startsWith("+")) return { mode: "capture", term: raw.slice(1).trim() };
  if (raw.startsWith("!")) return { mode: "run", term: raw.slice(1).trim() };
  return { mode: "default", term: raw.trim() };
}

const MODE_PILL: Record<Mode, { label: string; cls: string } | null> = {
  default: null,
  ask: { label: "Ask Curly", cls: "text-accent" },
  search: { label: "Search", cls: "text-accent-2" },
  capture: { label: "Capture", cls: "text-success" },
  run: { label: "Run agent", cls: "text-accent" },
};

export function CommandPalette() {
  const router = useRouter();
  const voice = useVoice();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // search mode
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  // ask mode
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [askSession, setAskSession] = useState<string | null>(null);
  const askRef = useRef<{ cancel: () => void } | null>(null);
  // capture mode
  const [capturing, setCapturing] = useState(false);

  const { mode, term } = parseQuery(q);

  // open / close wiring
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("curly-palette-open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("curly-palette-open", onOpen);
    };
  }, []);

  // reset transient state when toggled
  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setResults(null);
      setAnswer("");
      setAskSession(null);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    askRef.current?.cancel();
    setAsking(false);
  }, [open]);

  // debounced search
  useEffect(() => {
    if (mode !== "search" || term.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vault-search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setResults((await res.json()) as SearchResponse);
      } catch {
        /* aborted or failed */
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [mode, term]);

  // reset selection as the query changes
  useEffect(() => setSel(0), [q]);

  function close() {
    setOpen(false);
  }
  function go(path: string) {
    close();
    router.push(path);
  }
  function noteHref(rel: string) {
    return `/notes/${rel.split("/").map(encodeURIComponent).join("/")}`;
  }

  function runAsk(t: string) {
    if (!t || asking) return;
    setAnswer("");
    setAskSession(null);
    setAsking(true);
    askRef.current?.cancel();
    askRef.current = streamChat(
      { question: t, sessionId: null, think: false },
      {
        onDelta: (d) => setAnswer((a) => a + d),
        onResult: (r) => {
          if (r.sessionId) setAskSession(r.sessionId);
          if (r.result) setAnswer(r.result);
        },
        onError: (m) => setAnswer((a) => a || `⚠ ${m}`),
        onClose: () => setAsking(false),
      },
    );
  }

  async function runCapture(t: string) {
    if (!t || capturing) return;
    setCapturing(true);
    try {
      const slug = voice.here?.route.match(/^\/projects\/([^/]+)/)?.[1];
      const url = slug ? `/api/projects/${slug}/capture` : "/api/capture";
      const payload = slug ? { content: t } : { mode: "journal", content: t };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
      if (res.ok && data.ok !== false) {
        toast.success(slug ? `Captured to ${slug}` : "Captured to today's journal");
        close();
      } else {
        toast.error(data.reason || "Capture failed");
      }
    } catch {
      toast.error("Capture failed");
    } finally {
      setCapturing(false);
    }
  }

  // Build the keyboard-navigable action list for default/search modes.
  type Action = { key: string; node: React.ReactNode; run: () => void };
  const actions: Action[] = [];
  if (mode === "default") {
    if (term.length >= 1) {
      actions.push({
        key: "do-search",
        node: (
          <Row icon="⌕" iconCls="text-accent-2" label="Search" detail={`“${term}”`} kbd="↵" />
        ),
        run: () => setQ(`/${term}`),
      });
      actions.push({
        key: "do-ask",
        node: <Row icon="✦" iconCls="text-accent" label="Ask Curly" detail={`“${term}”`} />,
        run: () => setQ(`?${term}`),
      });
    }
    for (const n of NAV.filter((i) => !term || i.label.toLowerCase().includes(term.toLowerCase()))) {
      actions.push({
        key: `nav-${n.id}`,
        node: <Row label={n.label} detail={n.hint} muted />,
        run: () => go(n.path),
      });
    }
  } else if (mode === "search" && results) {
    actions.push({
      key: "search-all",
      node: <Row icon="⌕" iconCls="text-accent-2" label="See all results" detail={`/search?q=${term}`} kbd="↵" />,
      run: () => go(`/search?q=${encodeURIComponent(term)}`),
    });
    for (const n of results.notes.slice(0, 8)) {
      actions.push({
        key: `n-${n.rel}`,
        node: <Row label={n.title || n.rel} detail={n.snippet ?? n.rel} muted />,
        run: () => go(noteHref(n.rel)),
      });
    }
    for (const c of results.chats.slice(0, 5)) {
      actions.push({
        key: `c-${c.id}`,
        node: <Row icon="💬" label={c.first_q || c.snippet} detail={`${c.message_count} msg`} muted />,
        run: () => go(`/chat/${c.id}`),
      });
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, Math.max(actions.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (mode === "ask") runAsk(term);
      else if (mode === "capture") runCapture(term);
      else if (mode === "run") {
        if (term) go(`/agent?task=${encodeURIComponent(term)}`);
      } else if (actions[sel]) {
        actions[sel].run();
      }
    }
  }

  if (!open) return null;

  const pill = MODE_PILL[mode];
  const placeholder =
    mode === "ask"
      ? "Ask Curly anything…"
      : mode === "search"
        ? "Search your mind…"
        : mode === "capture"
          ? "Capture a thought…"
          : mode === "run"
            ? "Describe a task for Curly…"
            : "Ask · search · capture · go…  (try ? / + !)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[16vh] backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border-soft bg-surface/95 backdrop-blur-xl glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4">
          {pill && (
            <span className={`shrink-0 rounded-md bg-surface-2 px-2 py-1 text-xs font-medium ${pill.cls}`}>
              {pill.label}
            </span>
          )}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="w-full bg-transparent py-4 text-base text-foreground outline-none placeholder:text-muted"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto border-t border-border">
          {/* ASK — streamed answer inline */}
          {mode === "ask" && (
            <div className="px-5 py-4">
              {!answer && !asking && (
                <p className="text-sm text-muted">
                  Press <span className="text-foreground">↵</span> to ask Curly “{term || "…"}”.
                </p>
              )}
              {asking && !answer && <p className="text-sm text-muted">Curly is thinking…</p>}
              {answer && (
                <div className="prose prose-invert prose-sm max-w-none">
                  <Markdown>{answer}</Markdown>
                </div>
              )}
              {(answer || asking) && (
                <Link
                  href={askSession ? `/chat/${askSession}` : "/chat"}
                  onClick={close}
                  className="mt-3 inline-block text-xs text-accent hover:underline"
                >
                  Continue in chat →
                </Link>
              )}
            </div>
          )}

          {/* CAPTURE */}
          {mode === "capture" && (
            <div className="px-5 py-4 text-sm">
              {term ? (
                <>
                  <p className="text-subtle">{term}</p>
                  <p className="mt-2 text-xs text-muted">
                    {capturing
                      ? "Saving…"
                      : `↵ to capture to ${
                          voice.here?.route.match(/^\/projects\/([^/]+)/)?.[1] ?? "today’s journal"
                        }`}
                  </p>
                </>
              ) : (
                <p className="text-muted">Type a thought to capture…</p>
              )}
            </div>
          )}

          {/* RUN */}
          {mode === "run" && (
            <div className="px-5 py-4 text-sm">
              {term ? (
                <p className="text-muted">
                  ↵ to run agent: <span className="text-foreground">“{term}”</span>
                </p>
              ) : (
                <p className="text-muted">Describe a task for Curly to run…</p>
              )}
            </div>
          )}

          {/* SEARCH loading / empty */}
          {mode === "search" && term.length >= 2 && !results && (
            <p className="px-5 py-4 text-sm text-muted">{searching ? "Searching…" : "No matches."}</p>
          )}
          {mode === "search" && term.length < 2 && (
            <p className="px-5 py-4 text-sm text-muted">Type at least 2 characters…</p>
          )}

          {/* DEFAULT + SEARCH action list */}
          {(mode === "default" || (mode === "search" && results)) && (
            <div className="py-2">
              {actions.map((a, i) => (
                <button
                  key={a.key}
                  onMouseEnter={() => setSel(i)}
                  onClick={a.run}
                  className={`flex w-full items-center gap-3 px-5 py-2.5 text-left ${
                    i === sel ? "bg-surface-2" : "hover:bg-surface-2"
                  }`}
                >
                  {a.node}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-border px-5 py-2 text-[11px] text-muted">
          <span><span className="text-subtle">?</span> ask</span>
          <span><span className="text-subtle">/</span> search</span>
          <span><span className="text-subtle">+</span> capture</span>
          <span><span className="text-subtle">!</span> agent</span>
          <span className="ml-auto">↑↓ move · ↵ run · esc close</span>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  iconCls,
  label,
  detail,
  kbd,
  muted,
}: {
  icon?: string;
  iconCls?: string;
  label: string;
  detail?: string;
  kbd?: string;
  muted?: boolean;
}) {
  return (
    <>
      {icon && <span className={iconCls}>{icon}</span>}
      <span className="shrink-0 text-foreground">{label}</span>
      {detail && <span className={`truncate text-sm ${muted ? "text-muted" : "text-muted"}`}>{detail}</span>}
      {kbd && <span className="ml-auto text-xs text-muted">{kbd}</span>}
    </>
  );
}
