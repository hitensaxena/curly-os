'use client';

// Lazy-loads the heavy force-graph (ssr:false must live in a client module in
// Next 16) and fetches graph data over the API route (server-only sources).
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { StageGraph } from './types';

const ForceGraphClient = dynamic(() => import('./ForceGraphClient'), {
  ssr: false,
  loading: () => <div className="grid h-[42dvh] place-items-center text-xs text-muted">drawing your mind…</div>,
});

// Adapt curlyos-core's knowledge-graph payloads to the force-graph shape.
// Full graph: { nodes:[{id,name,label,degree}], links:[{source,target,rel_type}] }.
// Node expand: { entities:[{id,name,label}], edges:[{src_entity_id,dst_entity_id,rel_type}] }.
type CoreNode = { id: string; name?: string; label?: string; degree?: number };
type CoreLink = { source: string; target: string; rel_type?: string };
type CoreEntity = { id: string; name?: string; label?: string };
type CoreEdge = { src_entity_id: string; dst_entity_id: string; rel_type?: string };

function toStageGraph(d: unknown, nodeId: string | null): StageGraph {
  const g = (d ?? {}) as Record<string, unknown>;
  const rawNodes = (nodeId ? g.entities : g.nodes) as (CoreNode | CoreEntity)[] | undefined;
  const nodes = (rawNodes ?? []).map((n) => ({
    id: n.id,
    label: n.name ?? n.id,
    group: n.label ?? 'Entity',
    val: (n as CoreNode).degree ?? 1,
  }));
  const ids = new Set(nodes.map((n) => n.id));
  const links = nodeId
    ? ((g.edges as CoreEdge[] | undefined) ?? []).map((e) => ({
        source: e.src_entity_id,
        target: e.dst_entity_id,
        rel: e.rel_type,
      })).filter((l) => ids.has(l.source) && ids.has(l.target))
    : ((g.links as CoreLink[] | undefined) ?? []).map((l) => ({
        source: l.source,
        target: l.target,
        rel: l.rel_type,
      })).filter((l) => ids.has(l.source) && ids.has(l.target));
  return { nodes, links };
}

export function GraphPanel({ nodeId, title, onNodeClick }: { nodeId: string | null; title?: string; onNodeClick?: (id: string) => void }) {
  const [graph, setGraph] = useState<StageGraph | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    const url = nodeId
      ? `/api/graph/${encodeURIComponent(nodeId)}/expand?k=1`
      : `/api/graph`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setGraph(toStageGraph(d, nodeId));
      })
      .catch(() => {
        if (alive) setErr(true);
      });
    return () => {
      alive = false;
    };
  }, [nodeId]);

  return (
    <article className="glow pointer-events-auto w-full max-w-[640px] rounded-2xl border border-border bg-surface/80 p-3 backdrop-blur-md">
      <div className="mb-1 px-1 text-[11px] uppercase tracking-[0.15em] text-accent-2">{title || 'Your mind'}</div>
      {err || (graph && graph.nodes.length === 0) ? (
        <div className="grid h-[18dvh] place-items-center text-xs text-muted">no connections to show yet</div>
      ) : graph ? (
        <ForceGraphClient graph={graph} onNodeClick={onNodeClick} />
      ) : (
        <div className="grid h-[42dvh] place-items-center text-xs text-muted">drawing your mind…</div>
      )}
    </article>
  );
}
