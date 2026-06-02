// Typed client for the brain service (FastAPI on :8077). SERVER-ONLY — never
// import from a client component; it reads the API key off the host. The app
// talks to brain only through this module (and the /api/brain proxy).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BRAIN_URL = (process.env.BRAIN_URL ?? "http://127.0.0.1:8077").replace(/\/$/, "");

function resolveApiKey(): string {
  if (process.env.BRAIN_API_KEY) return process.env.BRAIN_API_KEY;
  // Dev convenience: first key from ~/brain/.env. In prod, set BRAIN_API_KEY.
  try {
    const env = fs.readFileSync(path.join(os.homedir(), "brain", ".env"), "utf8");
    const line = env.split("\n").find((l) => l.startsWith("BRAIN_API_KEYS="));
    if (line) return line.slice("BRAIN_API_KEYS=".length).split(",")[0].trim();
  } catch {
    /* not on dev host */
  }
  return "";
}

const KEY = resolveApiKey();

export type BrainNode = {
  id: string;
  type: string;
  title: string | null;
  content: string;
  source_app: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  _score?: number;
  _snippet?: string;
};

export type RagResult = {
  query: string;
  hits: BrainNode[];
  related: BrainNode[];
  edges: Array<{ src: string; dst: string; rel_type: string }>;
  context: string;
};

export type SearchHit = { node: BrainNode; score: number; snippet: string };

async function call<T>(
  endpoint: string,
  body?: unknown,
  method: "GET" | "POST" | "DELETE" = "POST",
  timeoutMs = 30_000,
): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(BRAIN_URL + endpoint, {
      method,
      headers: { "Content-Type": "application/json", "X-API-Key": KEY },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`brain ${method} ${endpoint} -> ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export const brain = {
  url: BRAIN_URL,
  hasKey: KEY.length > 0,
  rag: (query: string, k = 6) => call<RagResult>("/rag", { query, k }),
  search: (query: string, k = 8, type?: string) =>
    call<SearchHit[]>("/search", { query, k, type }),
  stats: () =>
    call<{ nodes: number; edges: number; chunks: number; pending: number }>(
      "/stats",
      undefined,
      "GET",
    ),
  // node ids contain "/" and ":" — encodeURI preserves them for the :path route.
  graph: (id: string, depth = 1) =>
    call<{ nodes: unknown[]; edges: unknown[] }>(
      `/graph/${encodeURI(id)}?depth=${depth}`,
      undefined,
      "GET",
    ),
  node: (id: string) =>
    call<BrainNode>(`/nodes/${encodeURI(id)}`, undefined, "GET"),
};
