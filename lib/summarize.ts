// Lazy LLM summarizer for chats. The hooks in chats-db (chatsNeedingResummary /
// setSummary) existed but nothing ran them; this fills that gap. Writes a
// one-line summary per chat.
//
// Goes through the same OpenCode Go bridge as /api/chat (lib/openrouter.ts)
// rather than spawning a `claude` CLI — the CLI is not on the launchd PATH and
// was not installed at the path this used to hardcode, so summaries silently
// never ran. Entirely failure-safe: any error just skips the chat.
import {
  CHAT_COMPLETIONS_URL,
  CHAT_MODEL_CHAIN,
  chatKey,
} from "@/lib/openrouter";
import { chatsNeedingResummary, getChat, setSummary } from "@/lib/chats-db";

async function complete(prompt: string, timeoutMs = 60_000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chatKey()}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL_CHAIN[0],
        messages: [{ role: "user", content: prompt }],
        stream: false,
        max_tokens: 256,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`bridge ${res.status}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return (json.choices?.[0]?.message?.content ?? "").trim();
  } finally {
    clearTimeout(timer);
  }
}

function transcript(messages: { role: string; content: string }[], cap = 6000): string {
  const s = messages
    .map((m) => `${m.role === "user" ? "Hiten" : "Curly"}: ${m.content}`)
    .join("\n\n");
  return s.length > cap ? s.slice(0, cap) + "\n…" : s;
}

// Summarize up to `batch` chats that are lagging. Returns how many it wrote.
export async function summarizePendingChats(batch = 3): Promise<{ summarized: number }> {
  let pending: Array<{ id: string }> = [];
  try {
    pending = chatsNeedingResummary().slice(0, batch);
  } catch {
    return { summarized: 0 };
  }
  let n = 0;
  for (const { id } of pending) {
    const chat = getChat(id);
    if (!chat || chat.messages.length === 0) continue;
    const prompt =
      "Summarize this conversation in ONE short sentence (max 12 words), plain and " +
      "specific, no preamble or quotes:\n\n" +
      transcript(chat.messages);
    try {
      const raw = await complete(prompt);
      const summary = raw.split("\n")[0].slice(0, 200).trim();
      if (summary) {
        setSummary(id, summary);
        n++;
      }
    } catch (e) {
      console.warn("[summarize] failed for", id, e instanceof Error ? e.message : e);
    }
  }
  return { summarized: n };
}
