'use client';

// The actual react-force-graph-2d render. Lives in its own client module so the
// dynamic ssr:false import (in GraphPanel) can target it. force-graph has no
// auto-resize, so a ResizeObserver feeds explicit width/height.
import { useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { StageGraph } from './types';

const FALLBACK_NODE_COLOR = '#2DE2E6';
const FALLBACK_LINK_COLOR = '#32324C';

export default function ForceGraphClient({ graph, onNodeClick }: { graph: StageGraph; onNodeClick?: (id: string) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [dim, setDim] = useState({ w: 600, h: 320 });
  const [nodeColor, setNodeColor] = useState(FALLBACK_NODE_COLOR);
  const [linkColor, setLinkColor] = useState(FALLBACK_LINK_COLOR);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDim({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setDim({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Resolve CSS tokens once on mount (canvas can't use CSS variables directly).
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const resolvedNode = style.getPropertyValue('--accent-2').trim();
    const resolvedLink = style.getPropertyValue('--border-soft').trim();
    if (resolvedNode) setNodeColor(resolvedNode);
    if (resolvedLink) setLinkColor(resolvedLink);
  }, []);

  return (
    <div ref={wrapRef} className="h-[42dvh] w-full overflow-hidden rounded-xl">
      <ForceGraph2D
        ref={fgRef}
        width={dim.w}
        height={dim.h}
        graphData={graph}
        backgroundColor="rgba(0,0,0,0)"
        nodeColor={() => nodeColor}
        nodeRelSize={3}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeVal={(n: any) => 1 + Math.sqrt(Number(n.val) || 1)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeLabel={(n: any) => String(n.label ?? n.id)}
        linkColor={() => linkColor}
        linkWidth={1}
        cooldownTicks={120}
        onEngineStop={() => fgRef.current?.zoomToFit?.(400, 30)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onNodeClick={(n: any) => onNodeClick?.(String(n.id))}
      />
    </div>
  );
}
