import { searchVaultContent, noteTitle } from "@/lib/vault-fs";
import { searchFiles } from "@/lib/graph";
import { searchChats } from "@/lib/chats-db";
import { brain } from "@/lib/brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SearchNote = {
  rel: string;
  title: string;
  snippet: string | null;
  source: "content" | "name" | "brain";
};

export type SearchResponse = {
  q: string;
  notes: SearchNote[];
  chats: {
    id: string;
    snippet: string;
    matched_in: string;
    first_q: string;
    message_count: number;
  }[];
};

// Pull a vault-relative path out of a brain search hit (node or {node,...}).
function relFromBrainHit(hit: unknown): string | null {
  const node = (hit as { node?: unknown })?.node ?? hit;
  const meta = (node as { metadata?: Record<string, unknown> })?.metadata ?? {};
  const cand = meta.vault_path ?? meta.path;
  if (typeof cand === "string" && cand.endsWith(".md")) return cand;
  const id = (node as { id?: unknown })?.id;
  if (typeof id === "string" && id.startsWith("mind:")) return id.slice(5);
  return null;
}

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return Response.json({ q, notes: [], chats: [] } satisfies SearchResponse);
  }

  const [contentRes, brainRes] = await Promise.allSettled([
    searchVaultContent(q, 30),
    brain.search(q, 8) as Promise<unknown>,
  ]);

  const content = contentRes.status === "fulfilled" ? contentRes.value : [];
  const brainRaw = brainRes.status === "fulfilled" ? brainRes.value : [];
  const brainArr: unknown[] = Array.isArray(brainRaw)
    ? brainRaw
    : ((brainRaw as { hits?: unknown[]; results?: unknown[] })?.hits ??
        (brainRaw as { results?: unknown[] })?.results ??
        []);

  // Merge by rel — content snippets win, then brain (semantic), then bare
  // filename matches. Keeps results unique and useful.
  const byRel = new Map<string, SearchNote>();
  for (const c of content) {
    byRel.set(c.rel, { rel: c.rel, title: "", snippet: c.snippet, source: "content" });
  }
  for (const hit of brainArr) {
    const rel = relFromBrainHit(hit);
    if (!rel || byRel.has(rel)) continue;
    const snip = (hit as { snippet?: unknown })?.snippet;
    byRel.set(rel, {
      rel,
      title: "",
      snippet: typeof snip === "string" ? snip.slice(0, 160) : null,
      source: "brain",
    });
  }
  for (const rel of searchFiles(q, 30)) {
    if (byRel.has(rel)) continue;
    byRel.set(rel, { rel, title: "", snippet: null, source: "name" });
  }

  const notes = [...byRel.values()].slice(0, 25);
  // Resolve real titles for the shown results (cheap head reads, in parallel).
  await Promise.all(
    notes.map(async (n) => {
      n.title = await noteTitle(n.rel);
    }),
  );

  let chats: SearchResponse["chats"] = [];
  try {
    chats = searchChats(q)
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        snippet: c.snippet,
        matched_in: c.matched_in,
        first_q: c.first_q,
        message_count: c.message_count,
      }));
  } catch {
    /* chats db may not exist yet */
  }

  return Response.json({ q, notes, chats } satisfies SearchResponse);
}
