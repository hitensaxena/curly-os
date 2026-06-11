"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const API = "";

interface GraphNode {
  id: string;
  name: string;
  label: string;
  degree: number;
}

interface GraphLink {
  source: string;
  target: string;
  rel_type: string;
}

interface ExpandEntity {
  id: string;
  name: string;
  label: string;
  properties?: Record<string, unknown> | null;
  epistemic_status?: string;
  valid_from?: string;
  valid_to?: string;
  source_episode_id?: string;
  created_at?: string;
}

interface ExpandEdge {
  id: string;
  src_entity_id: string;
  dst_entity_id: string;
  rel_type: string;
}

interface Expansion {
  entities: ExpandEntity[];
  edges: ExpandEdge[];
}

const LABEL_COLORS: Record<string, string> = {
  Person: "#60a5fa",
  Organization: "#22d3ee",
  Project: "#f472b6",
  Tool: "#a78bfa",
  Skill: "#34d399",
  Concept: "#fbbf24",
  Place: "#fb923c",
  Event: "#fb7185",
  Health: "#f87171",
  Media: "#2dd4bf",
  Activity: "#a3e635",
  Other: "#6b7280",
};

const STATUS_TEXT: Record<string, string> = {
  canonical: "text-green-400",
  belief: "text-blue-400",
  hypothesis: "text-yellow-400",
};

function epistemicColor(s?: string): string {
  if (!s) return "text-muted";
  return STATUS_TEXT[s] ?? "text-muted";
}

function formatDate(d?: string): string | null {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return null;
  }
}

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [expansion, setExpansion] = useState<Expansion | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [k, setK] = useState<1 | 2 | 3>(1);
  const fgRef = useRef<any>(null);

  useEffect(() => {
    fetch(`${API}/api/graph`).then((r) => r.json()).then((d) => {
      setNodes(d.nodes || []);
      setLinks(d.links || []);
      setLoading(false);
    });
  }, []);

  const fetchExpansion = useCallback((nodeId: string, hops: 1 | 2 | 3) => {
    setExpandLoading(true);
    fetch(`${API}/api/graph/${nodeId}/expand?k=${hops}`)
      .then((r) => r.json())
      .then((d: Expansion) => setExpansion(d))
      .catch(() => setExpansion(null))
      .finally(() => setExpandLoading(false));
  }, []);

  const selectNode = (node: GraphNode) => {
    setSelected(node);
    setExpansion(null);
    fetchExpansion(node.id, k);
  };

  // Re-fetch when k changes and a node is already selected
  useEffect(() => {
    if (selected) {
      fetchExpansion(selected.id, k);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

  const filteredNodes = search
    ? nodes.filter((n) => n.name.toLowerCase().includes(search.toLowerCase()) || n.label.toLowerCase().includes(search.toLowerCase()))
    : nodes;

  const nodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredLinks = links.filter((l) => nodeIds.has(typeof l.source === "string" ? l.source : (l.source as any).id) && nodeIds.has(typeof l.target === "string" ? l.target : (l.target as any).id));

  const graphData = {
    nodes: filteredNodes.map((n) => ({ ...n })),
    links: filteredLinks.map((l) => ({ ...l })),
  };

  // Find the selected entity's full detail from expansion
  const selectedDetail: ExpandEntity | null =
    selected && expansion?.entities
      ? expansion.entities.find((e) => e.id === selected.id) ?? null
      : null;

  const hasProperties =
    selectedDetail?.properties &&
    Object.keys(selectedDetail.properties).length > 0;

  if (loading) return <div className="flex items-center justify-center h-64 text-muted">Loading graph...</div>;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-foreground mb-1">Knowledge Graph</h1>
      <p className="text-sm text-muted mb-4">{nodes.length} entities, {links.length} relationships</p>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter entities..."
        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent mb-4"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 rounded-lg border border-border bg-surface" style={{ height: "70vh" }}>
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            nodeLabel={(n: any) => `${n.name} [${n.label}]`}
            nodeColor={(n: any) => LABEL_COLORS[n.label] || "#6b7280"}
            nodeRelSize={6}
            nodeVal={(n: any) => Math.max(2, (n.degree || 1) * 0.8)}
            linkColor={() => "#3f3f46"}
            linkWidth={1}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={0.8}
            onNodeClick={(node: any) => selectNode(node)}
            width={undefined}
            height={undefined}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />
        </div>

        <div className="lg:col-span-1">
          {selected ? (
            <div className="rounded-lg border border-border bg-surface p-4">
              {/* Header row */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono" style={{ color: LABEL_COLORS[selected.label] || "#6b7280" }}>
                  {selected.label}
                </span>
                <button
                  onClick={() => { setSelected(null); setExpansion(null); }}
                  className="text-xs text-muted hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              {/* Entity name */}
              <h3 className="text-sm font-semibold text-foreground mb-2">{selected.name}</h3>

              {/* Degree */}
              <div className="text-xs text-muted mb-2">Degree: {selected.degree}</div>

              {/* Epistemic status chip — from expansion detail */}
              {selectedDetail?.epistemic_status && (
                <div className="mb-2">
                  <span className={`text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border border-current ${epistemicColor(selectedDetail.epistemic_status)}`}>
                    {selectedDetail.epistemic_status}
                  </span>
                </div>
              )}

              {/* Valid from */}
              {selectedDetail?.valid_from && formatDate(selectedDetail.valid_from) && (
                <div className="text-xs text-muted mb-2">
                  Since: <span className="text-foreground/70">{formatDate(selectedDetail.valid_from)}</span>
                </div>
              )}

              {/* Properties */}
              {hasProperties && (
                <div className="mb-3">
                  <div className="text-[10px] text-muted uppercase tracking-wide mb-1">Properties</div>
                  <div className="space-y-0.5">
                    {Object.entries(selectedDetail!.properties!).map(([k, v]) => (
                      <div key={k} className="text-[10px] text-foreground/70 flex gap-1">
                        <span className="text-muted shrink-0">{k}:</span>
                        <span className="truncate">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hops selector */}
              <div className="flex items-center gap-2 mb-3 mt-1">
                <span className="text-[10px] text-muted">Hops:</span>
                {([1, 2, 3] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setK(n)}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      k === n
                        ? "border-accent text-accent"
                        : "border-border text-muted hover:text-foreground hover:border-foreground/30"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                {expandLoading && <span className="text-[10px] text-muted ml-1">…</span>}
              </div>

              {/* Edges with rel_type + direction */}
              {expansion && (expansion.entities?.length > 0 || expansion.edges?.length > 0) && (
                <div className="border-t border-border pt-3 mt-1">
                  <div className="text-[10px] text-muted uppercase tracking-wide mb-2">Connections</div>
                  {expansion.edges?.map((e: ExpandEdge, i: number) => {
                    const isOutgoing = e.src_entity_id === selected.id;
                    const otherId = isOutgoing ? e.dst_entity_id : e.src_entity_id;
                    const other = expansion.entities?.find((en: ExpandEntity) => en.id === otherId);
                    const otherName = other?.name ?? otherId ?? "?";
                    return (
                      <div key={i} className="text-[10px] text-foreground/80 mb-1 leading-relaxed">
                        {isOutgoing ? (
                          <>
                            <span className="text-accent">→ {e.rel_type}</span>
                            <span className="text-muted"> → </span>
                            <span>{otherName}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-muted">{otherName}</span>
                            <span className="text-muted"> → </span>
                            <span className="text-accent">{e.rel_type} →</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted text-center">
              Click a node to explore
            </div>
          )}

          {/* Legend */}
          <div className="rounded-lg border border-border bg-surface p-3 mt-3">
            <div className="text-xs text-muted mb-2">Legend</div>
            {Object.entries(LABEL_COLORS).map(([label, color]) => (
              <div key={label} className="flex items-center gap-2 text-xs text-foreground/80 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
