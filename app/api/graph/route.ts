// Bridges the two server-only graph sources to the client canvas. The graph
// panel fetches this; it never imports the server libs directly.
import { brain } from '@/lib/brain';
import { getAllNodesAndLinks } from '@/lib/graph';
import { normalizeBrainGraph, normalizeSnapshot } from '@/lib/graph-normalize';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const depth = Number(url.searchParams.get('depth') ?? '1') || 1;
  try {
    if (id) {
      // Per-node neighborhood from the brain. It's empty today (EXTRACTOR=none,
      // 0 edges), so fall through to the full wiki-link graph unless it has edges.
      const norm = normalizeBrainGraph(await brain.graph(id, depth));
      if (norm.links.length > 0) return Response.json(norm);
    }
    return Response.json(normalizeSnapshot(getAllNodesAndLinks()));
  } catch {
    return Response.json({ nodes: [], links: [] });
  }
}
