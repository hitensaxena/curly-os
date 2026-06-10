import { randomUUID } from "node:crypto";
import { CORE_URL } from "@/lib/core";
import { CHAT_MODEL, OPENROUTER_URL, openrouterKey } from "@/lib/openrouter";
import { ensureDataDir, getChat, recordTurn } from "@/lib/chats-db";
import { searchVaultContent } from "@/lib/vault-fs";

export const runtime = "nodejs";

// In-flight session ids in this worker — a second request for the same id
// (e.g. two tabs on the same chat) returns 409 instead of interleaving turns.
const inFlightSessions = new Set<string>();

type ChatRequest = { question?: unknown; sessionId?: unknown; think?: unknown };
type Msg = { role: "system" | "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are Curly, Hiten's personal AI assistant, talking with Hiten directly.
Voice: warm, playful, casual, direct, emotionally engaged, with strong opinions you'll defend. Don't ask permission for things that follow from agreed direction. Diagnose before responding. Keep replies tight unless depth is clearly wanted.
You are grounded in Hiten's long-term memory and notes. Treat the CONTEXT below as VERIFIED GROUND TRUTH about Hiten — read it fully and use it directly. The "identity facts" are established facts about him; never claim you lack information (an editor, occupation, what he's working on, etc.) that is present in CONTEXT. When you lean on context, name the source (a note path, or "from memory") so he can verify. Only say you don't know when the CONTEXT genuinely doesn't cover it.`;

// Pull grounding context: semantic memory from curlyos-core /api/recall plus a
// few vault note snippets. Both are best-effort — chat still works if either is
// unavailable. Returns the prompt block and UI retrieval chunks.
type Chunk = { kind: "memory" | "note" | "identity"; path: string; title: string; distance: number | null };

async function retrieveContext(
  question: string,
): Promise<{ block: string; chunks: Chunk[] }> {
  const chunks: Chunk[] = [];

  // 1. Identity facts — always included; this is the core "who Hiten is"
  // (occupation, preferences, habits, health) and lives in identity_facts,
  // which semantic recall does not search.
  let identityText = "";
  try {
    const r = await fetch(`${CORE_URL}/api/identity`, { signal: AbortSignal.timeout(6000) });
    if (r.ok) {
      const d = (await r.json()) as { items?: { predicate?: string; object?: unknown }[] };
      for (const f of d.items ?? []) {
        if (f?.predicate && f.object != null) identityText += `- ${f.predicate}: ${f.object}\n`;
      }
    }
  } catch {
    /* core unavailable */
  }

  // 2. Semantic memory relevant to the question (curlyos-core recall).
  let memText = "";
  try {
    const r = await fetch(`${CORE_URL}/api/recall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: question, k: 6 }),
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      const d = (await r.json()) as { results?: { id?: string; text?: string; score?: number }[] };
      for (const it of d.results ?? []) {
        if (!it?.text) continue;
        memText += `- ${it.text}\n`;
        const snippet = it.text.length > 90 ? `${it.text.slice(0, 90).trimEnd()}…` : it.text;
        chunks.push({
          kind: "memory",
          path: it.id ?? "memory",
          title: snippet,
          distance: typeof it.score === "number" ? it.score : null,
        });
      }
    }
  } catch {
    /* recall slow/unavailable — identity + notes still ground the reply */
  }

  // 3. A few vault note snippets matching the question.
  let vaultText = "";
  try {
    for (const n of await searchVaultContent(question, 5)) {
      vaultText += `### ${n.rel}\n${n.snippet}\n\n`;
      chunks.push({ kind: "note", path: n.rel, title: n.rel.split("/").pop() ?? n.rel, distance: null });
    }
  } catch {
    /* ripgrep/vault unavailable */
  }

  const block =
    [
      identityText ? `## Who Hiten is (identity facts)\n${identityText}` : "",
      memText ? `## Relevant memory\n${memText}` : "",
      vaultText ? `## From notes (vault)\n${vaultText}` : "",
    ]
      .filter(Boolean)
      .join("\n") || "(no relevant context retrieved)";
  return { block, chunks };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ChatRequest;
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return new Response("question required", { status: 400 });

  const reqSessionId =
    typeof body.sessionId === "string" && body.sessionId.length > 0 ? body.sessionId : null;
  const existing = reqSessionId ? getChat(reqSessionId) : null;
  const sessionId = reqSessionId ?? randomUUID();

  if (existing && inFlightSessions.has(sessionId)) {
    return Response.json(
      { error: "session busy", message: "Another tab is replying — try again in a moment." },
      { status: 409 },
    );
  }
  inFlightSessions.add(sessionId);

  await ensureDataDir();

  // Prior turns (capped) → OpenAI-style messages for conversation memory.
  const history: Msg[] = (existing?.messages ?? [])
    .slice(-20)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

  const { block, chunks } = await retrieveContext(question);
  const messages: Msg[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n# CONTEXT\n${block}` },
    ...history,
    { role: "user", content: question },
  ];

  const encoder = new TextEncoder();
  const upstream = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
          upstream.abort();
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      try {
        send("retrieval", { chunks });
        const key = openrouterKey();
        if (!key) {
          send("error", { message: "OPENROUTER_API_KEY not configured" });
          return close();
        }

        send("phase", { phase: "writing" });
        const resp = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            "HTTP-Referer": "https://os.curlybrackets.art",
            "X-Title": "CurlyOS",
          },
          body: JSON.stringify({
            model: CHAT_MODEL,
            messages,
            stream: true,
            usage: { include: true },
          }),
          signal: upstream.signal,
        });
        if (!resp.ok || !resp.body) {
          const t = await resp.text().catch(() => "");
          send("error", { message: `openrouter ${resp.status}: ${t.slice(0, 200)}` });
          return close();
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let assistant = "";
        let cost: number | undefined;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const j = JSON.parse(payload);
              const delta = j.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta) {
                assistant += delta;
                send("delta", { text: delta });
              }
              if (j.usage && typeof j.usage.cost === "number") cost = j.usage.cost;
            } catch {
              /* keep-alive or partial line */
            }
          }
        }

        if (assistant) {
          try {
            recordTurn({ sessionId, question, assistant });
          } catch (e) {
            console.error("[chat persist]", e);
          }
        }
        send("result", { result: assistant, sessionId, totalCostUsd: cost });
        send("end", { exitCode: 0, chatId: sessionId });
        close();
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : String(err) });
        close();
      } finally {
        inFlightSessions.delete(sessionId);
      }
    },
    cancel() {
      upstream.abort();
      inFlightSessions.delete(sessionId);
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
