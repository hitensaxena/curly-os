import { searchVaultContent, noteTitle } from "@/lib/vault-fs";
import { searchFiles } from "@/lib/graph";
import { searchChats } from "@/lib/chats-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Local quick-search over the vault (notes + filenames) and past chats. Used by
// the ⌘K command palette for fast navigation. Deep semantic search over the
// cognitive store lives in curlyos-core and is reached via /api/search.
export type SearchNote = {
  rel: string;
  title: string;
  snippet: string | null;
  source: "content" | "name";
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

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return Response.json({ q, notes: [], chats: [] } satisfies SearchResponse);
  }

  const content = await searchVaultContent(q, 30).catch(() => []);

  // Merge by rel — content snippets win, then bare filename matches.
  const byRel = new Map<string, SearchNote>();
  for (const c of content) {
    byRel.set(c.rel, { rel: c.rel, title: "", snippet: c.snippet, source: "content" });
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
