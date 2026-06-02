// Adapters: the two server-side graph sources -> the force-graph {nodes,links}
// shape the client renders. Defensive about the brain /graph payload (its node/
// edge field names are not guaranteed; only RagResult.edges{src,dst,rel_type} is typed).
import type { StageGraph } from '@/components/stage/types';
import type { GraphSnapshot } from '@/lib/graph';

const MAX_NODES = 400;

function basename(p: string): string {
  const parts = p.split('/');
  return (parts[parts.length - 1] || p).replace(/\.md$/, '').replace(/-/g, ' ');
}

/** ~/mind/systems/graph.sqlite wiki-link graph (rich, populated). */
export function normalizeSnapshot(g: GraphSnapshot): StageGraph {
  const nodes = g.nodes.slice(0, MAX_NODES).map((n) => ({ id: n.id, label: basename(n.id), group: n.dir, val: n.degree }));
  const ids = new Set(nodes.map((n) => n.id));
  const links = g.links
    .filter((l) => ids.has(l.source) && ids.has(l.target))
    .map((l) => ({ source: l.source, target: l.target }));
  return { nodes, links };
}

/** brain /graph neighborhood (sparse until entity extraction runs / EXTRACTOR!=none). */
export function normalizeBrainGraph(g: { nodes: unknown[]; edges: unknown[] }): StageGraph {
  const nodes = (g.nodes ?? [])
    .slice(0, MAX_NODES)
    .map((raw) => {
      const n = raw as Record<string, unknown>;
      const id = String(n.id ?? n.node_id ?? '');
      return { id, label: String(n.title ?? n.label ?? basename(id)), group: String(n.type ?? 'node'), val: 1 };
    })
    .filter((n) => n.id);
  const ids = new Set(nodes.map((n) => n.id));
  const links = (g.edges ?? [])
    .map((raw) => {
      const e = raw as Record<string, unknown>;
      return { source: String(e.src ?? e.source ?? ''), target: String(e.dst ?? e.target ?? ''), rel: e.rel_type as string | undefined };
    })
    .filter((l) => ids.has(l.source) && ids.has(l.target));
  return { nodes, links };
}
