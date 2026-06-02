'use client';

// The actual react-force-graph-2d render. Lives in its own client module so the
// dynamic ssr:false import (in GraphPanel) can target it. force-graph has no
// auto-resize, so a ResizeObserver feeds explicit width/height.
import { useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { StageGraph } from './types';

export default function ForceGraphClient({ graph, onNodeClick }: { graph: StageGraph; onNodeClick?: (id: string) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [dim, setDim] = useState({ w: 600, h: 320 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDim({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setDim({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="h-[42dvh] w-full overflow-hidden rounded-xl">
      <ForceGraph2D
        ref={fgRef}
        width={dim.w}
        height={dim.h}
        graphData={graph}
        backgroundColor="rgba(0,0,0,0)"
        nodeColor={() => '#2DE2E6'}
        nodeRelSize={3}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeVal={(n: any) => 1 + Math.sqrt(Number(n.val) || 1)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeLabel={(n: any) => String(n.label ?? n.id)}
        linkColor={() => '#32324C'}
        linkWidth={1}
        cooldownTicks={120}
        onEngineStop={() => fgRef.current?.zoomToFit?.(400, 30)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onNodeClick={(n: any) => onNodeClick?.(String(n.id))}
      />
    </div>
  );
}
