import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promises as fsp } from "node:fs";

// Project-local runtime data (gitignored). Distinct from ~/mind/systems/graph.sqlite.
const DB_PATH = path.join(process.cwd(), "data", "chats.sqlite");

let _db: DatabaseSync | null = null;
let _initialized = false;

function db(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec("PRAGMA journal_mode=WAL");
    _db.exec("PRAGMA busy_timeout=5000");
  }
  if (!_initialized) {
    _db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id          TEXT PRIMARY KEY,
        started_at  INTEGER NOT NULL,
        first_q     TEXT    NOT NULL,
        summary     TEXT,
        starred     INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS messages (
        chat_id     TEXT    NOT NULL,
        role        TEXT    NOT NULL,
        content     TEXT    NOT NULL,
        ts          INTEGER NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats(id)
      );
      CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, ts);
      CREATE INDEX IF NOT EXISTS idx_chats_started ON chats(started_at DESC);
      CREATE TABLE IF NOT EXISTS essay_hits (
        slug        TEXT    NOT NULL,
        ts          INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_essay_hits_slug ON essay_hits(slug, ts);
    `);
    // Idempotent column add — node:sqlite throws if it already exists.
    try {
      _db.exec("ALTER TABLE chats ADD COLUMN summary_msg_count INTEGER");
    } catch {
      // already added
    }
    _initialized = true;
  }
  return _db;
}

// Bump the read counter for an essay slug. Fire-and-forget — failures are
// logged but never propagate, since this is observability, not load-bearing.
export function recordEssayHit(slug: string): void {
  try {
    db().prepare("INSERT INTO essay_hits (slug, ts) VALUES (?, ?)").run(slug, Date.now());
  } catch (err) {
    console.warn("[chats-db] essay hit insert failed:", err);
  }
}

export function topEssayHits(
  limit = 10,
): Array<{ slug: string; hits: number }> {
  const conn = db();
  const rows = conn
    .prepare(
      `SELECT slug, COUNT(*) AS hits
       FROM essay_hits
       GROUP BY slug
       ORDER BY hits DESC, slug ASC
       LIMIT ?`,
    )
    .all(limit) as Array<{ slug: string; hits: number }>;
  return rows.map(plain);
}

// Chats whose summary lags the current message count and which have been
// quiet long enough that a re-summary would be useful. Cheap heuristic.
export function chatsNeedingResummary(
  opts: { gap?: number; idleMs?: number } = {},
): Array<{ id: string; message_count: number }> {
  const { gap = 4, idleMs = 24 * 60 * 60 * 1000 } = opts;
  const cutoff = Date.now() - idleMs;
  const conn = db();
  const rows = conn
    .prepare(
      `SELECT c.id,
              (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) AS message_count,
              (SELECT MAX(ts)  FROM messages WHERE chat_id = c.id) AS last_ts
       FROM chats c
       WHERE message_count >= ?
         AND last_ts < ?
         AND (
           c.summary IS NULL
           OR message_count - COALESCE(c.summary_msg_count, 0) >= ?
         )
       ORDER BY c.started_at DESC`,
    )
    .all(gap, cutoff, gap) as Array<{
    id: string;
    message_count: number;
    last_ts: number;
  }>;
  return rows.map(({ id, message_count }) => ({ id, message_count }));
}

export type ChatRow = {
  id: string;
  started_at: number;
  first_q: string;
  summary: string | null;
  starred: 0 | 1;
};

export type MessageRow = {
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
};

export async function ensureDataDir(): Promise<void> {
  await fsp.mkdir(path.dirname(DB_PATH), { recursive: true });
}

// Insert one turn (user + assistant) under the given claude session id.
// First call for a session_id creates the chat row; later calls only append messages.
export function recordTurn(opts: {
  sessionId: string;
  question: string;
  assistant: string;
}): void {
  const conn = db();
  const now = Date.now();
  conn
    .prepare(
      "INSERT OR IGNORE INTO chats (id, started_at, first_q) VALUES (?, ?, ?)"
    )
    .run(opts.sessionId, now, opts.question);
  const insert = conn.prepare(
    "INSERT INTO messages (chat_id, role, content, ts) VALUES (?, ?, ?, ?)"
  );
  insert.run(opts.sessionId, "user", opts.question, now);
  insert.run(opts.sessionId, "assistant", opts.assistant, now + 1);
}

// node:sqlite returns rows with `null` prototype, which Next.js 16's RSC
// serializer rejects when passed to client components. Convert every row
// to a plain object on the way out.
function plain<T extends object>(row: T): T {
  return { ...row };
}

export function listChats(): Array<ChatRow & { message_count: number }> {
  const conn = db();
  const rows = conn
    .prepare(
      `SELECT
         c.id,
         c.started_at,
         c.first_q,
         c.summary,
         c.starred,
         COUNT(m.chat_id) AS message_count
       FROM chats c
       LEFT JOIN messages m ON m.chat_id = c.id
       GROUP BY c.id
       ORDER BY c.started_at DESC`
    )
    .all() as Array<ChatRow & { message_count: number }>;
  return rows.map(plain);
}

export function getChat(id: string): { chat: ChatRow; messages: MessageRow[] } | null {
  const conn = db();
  const chat = conn
    .prepare("SELECT id, started_at, first_q, summary, starred FROM chats WHERE id = ?")
    .get(id) as ChatRow | undefined;
  if (!chat) return null;
  const messages = conn
    .prepare("SELECT chat_id, role, content, ts FROM messages WHERE chat_id = ? ORDER BY ts ASC")
    .all(id) as MessageRow[];
  return { chat: plain(chat), messages: messages.map(plain) };
}

export function setStarred(id: string, starred: boolean): boolean {
  const conn = db();
  const r = conn.prepare("UPDATE chats SET starred = ? WHERE id = ?").run(starred ? 1 : 0, id);
  return r.changes > 0;
}

export function deleteChat(id: string): boolean {
  const conn = db();
  conn.prepare("DELETE FROM messages WHERE chat_id = ?").run(id);
  const r = conn.prepare("DELETE FROM chats WHERE id = ?").run(id);
  return r.changes > 0;
}

export function setSummary(id: string, summary: string): void {
  const conn = db();
  conn
    .prepare(
      `UPDATE chats
       SET summary = ?,
           summary_msg_count = (SELECT COUNT(*) FROM messages WHERE chat_id = ?)
       WHERE id = ?`,
    )
    .run(summary, id, id);
}

export function latestChat(): { id: string; started_at: number } | null {
  const conn = db();
  const row = conn
    .prepare("SELECT id, started_at FROM chats ORDER BY started_at DESC LIMIT 1")
    .get() as { id: string; started_at: number } | undefined;
  return row ? plain(row) : null;
}

// Newest chat with > 2 messages and no summary yet, or null if all caught up.
// Used to drive lazy LLM summarization on /sessions page loads.
export function nextChatNeedingSummary(): string | null {
  const conn = db();
  const row = conn
    .prepare(
      `SELECT c.id
       FROM chats c
       WHERE c.summary IS NULL
         AND (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) > 2
       ORDER BY c.started_at DESC
       LIMIT 1`
    )
    .get() as { id: string } | undefined;
  return row?.id ?? null;
}

export type SearchHit = ChatRow & {
  message_count: number;
  snippet: string;
  matched_in: "first_q" | "summary" | "message";
};

// Substring search across first_q + summary + every message body.
// Returns one row per chat, with a snippet drawn from whichever field
// matched first (preferring messages so the user sees the actual hit).
export function searchChats(query: string): SearchHit[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const conn = db();
  const like = `%${q.replace(/[%_]/g, (c) => "\\" + c)}%`;

  // Pull every chat whose first_q/summary OR any message matches.
  const rows = conn
    .prepare(
      `SELECT
         c.id,
         c.started_at,
         c.first_q,
         c.summary,
         c.starred,
         (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) AS message_count,
         (SELECT content FROM messages
            WHERE chat_id = c.id AND content LIKE ? ESCAPE '\\'
            ORDER BY ts ASC LIMIT 1) AS matched_message
       FROM chats c
       WHERE c.first_q LIKE ? ESCAPE '\\'
          OR COALESCE(c.summary, '') LIKE ? ESCAPE '\\'
          OR EXISTS (SELECT 1 FROM messages
                       WHERE chat_id = c.id AND content LIKE ? ESCAPE '\\')
       ORDER BY c.started_at DESC`
    )
    .all(like, like, like, like) as Array<
      ChatRow & {
        message_count: number;
        matched_message: string | null;
      }
    >;

  return rows.map((row) => {
    let matched_in: SearchHit["matched_in"] = "first_q";
    let snippet = "";
    if (row.matched_message) {
      matched_in = "message";
      snippet = snippetAround(row.matched_message, q);
    } else if ((row.summary ?? "").toLowerCase().includes(q.toLowerCase())) {
      matched_in = "summary";
      snippet = snippetAround(row.summary ?? "", q);
    } else {
      matched_in = "first_q";
      snippet = snippetAround(row.first_q, q);
    }
    return plain({
      id: row.id,
      started_at: row.started_at,
      first_q: row.first_q,
      summary: row.summary,
      starred: row.starred,
      message_count: row.message_count,
      snippet,
      matched_in,
    });
  });
}

function snippetAround(text: string, query: string, radius = 80): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end).replace(/\s+/g, " ").trim() + suffix;
}
