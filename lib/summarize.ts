// Lazy LLM summarizer for chats. The hooks in chats-db (chatsNeedingResummary /
// setSummary) existed but nothing ran them; this fills that gap. Spawns the
// `claude` CLI in print mode (-p, Max-subscription auth, no API key) and writes
// a one-line summary. Entirely failure-safe — any spawn error just skips the
// chat, so a flaky CLI never breaks a page load.
import { spawn } from "node:child_process";
import path from "node:path";
import { HOME } from "@/lib/paths";
import { chatsNeedingResummary, getChat, setSummary } from "@/lib/chats-db";

const CLAUDE_BIN = path.join(HOME, ".local", "bin", "claude");

function runClaude(prompt: string, timeoutMs = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(CLAUDE_BIN, ["-p", prompt], {
      cwd: HOME,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      try {
        proc.kill("SIGTERM");
      } catch {
        /* already gone */
      }
      reject(new Error("claude timeout"));
    }, timeoutMs);
    proc.stdout.on("data", (d: Buffer) => (out += d.toString("utf8")));
    proc.stderr.on("data", (d: Buffer) => (err += d.toString("utf8")));
    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude exit ${code}: ${err.slice(0, 200)}`));
    });
  });
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
      const raw = await runClaude(prompt);
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
