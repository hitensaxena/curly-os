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

export function GraphPanel({ nodeId, title, onNodeClick }: { nodeId: string | null; title?: string; onNodeClick?: (id: string) => void }) {
  const [graph, setGraph] = useState<StageGraph | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    const q = nodeId ? `?id=${encodeURIComponent(nodeId)}&depth=1` : '';
    fetch(`/api/graph${q}`)
      .then((r) => r.json())
      .then((d: StageGraph) => {
        if (alive) setGraph(d);
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
