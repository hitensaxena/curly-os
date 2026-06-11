"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const API = "";

interface GraphNode {
  id: string;
  name: string;
  label: string;
  degree: number;
  // populated by the force engine at runtime
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
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
const typeColor = (label: string) => LABEL_COLORS[label] || "#6b7280";

// The densification pass (deploy/densify_kg.py) writes only these two rel_types;
// everything else is an asserted/extracted relation. Lets us distinguish inferred
// links in the UI without any extra API field.
const INFERRED_RELS = new Set(["related_to", "co_occurs_with"]);
const relOf = (l: GraphLink) => l.rel_type;
const isInferred = (l: GraphLink) => INFERRED_RELS.has(relOf(l));
const endId = (e: string | GraphNode) => (typeof e === "object" ? e.id : e);

const STATUS_TEXT: Record<string, string> = {
  canonical: "text-success",
  belief: "text-accent-2",
  hypothesis: "text-warning",
};
const epistemicColor = (s?: string) => (s ? STATUS_TEXT[s] ?? "text-muted" : "text-muted");

function formatDate(d?: string): string | null {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return null;
  }
}

const DEGREE_PRESETS: { label: string; min: number }[] = [
  { label: "All", min: 0 },
  { label: "≥2", min: 2 },
  { label: "≥3", min: 3 },
  { label: "≥5", min: 5 },
  { label: "≥10", min: 10 },
];

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [expansion, setExpansion] = useState<Expansion | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // view controls
  const [search, setSearch] = useState("");
  const [k, setK] = useState<1 | 2 | 3>(1);
  const [enabledTypes, setEnabledTypes] = useState<Set<string> | null>(null); // null = all
  const [minDegree, setMinDegree] = useState(0);
  const [showInferred, setShowInferred] = useState(true);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const fgRef = useRef<any>(null);

  useEffect(() => {
    fetch(`${API}/api/graph`)
      .then((r) => r.json())
      .then((d) => {
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

  const selectNode = useCallback(
    (node: GraphNode) => {
      setSelected(node);
      setExpansion(null);
      fetchExpansion(node.id, k);
      // ease the camera onto the chosen node
      if (fgRef.current && typeof node.x === "number" && typeof node.y === "number") {
        fgRef.current.centerAt(node.x, node.y, 600);
        fgRef.current.zoom(Math.max(2.2, fgRef.current.zoom?.() ?? 2.2), 600);
      }
    },
    [fetchExpansion, k]
  );

  useEffect(() => {
    if (selected) fetchExpansion(selected.id, k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

  // ── full-graph stats (independent of the active filters) ──────────────────
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of nodes) c[n.label] = (c[n.label] || 0) + 1;
    return c;
  }, [nodes]);
  const allTypes = useMemo(
    () => Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a]),
    [typeCounts]
  );

  const stats = useMemo(() => {
    if (!nodes.length) return { components: 0, orphans: 0, largest: 0, inferred: 0 };
    const parent: Record<string, string> = {};
    nodes.forEach((n) => (parent[n.id] = n.id));
    const find = (x: string): string => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    let inferred = 0;
    for (const l of links) {
      if (isInferred(l)) inferred++;
      const a = endId(l.source);
      const b = endId(l.target);
      if (parent[a] === undefined || parent[b] === undefined) continue;
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    }
    const sizes: Record<string, number> = {};
    nodes.forEach((n) => {
      const r = find(n.id);
      sizes[r] = (sizes[r] || 0) + 1;
    });
    const sizeArr = Object.values(sizes);
    const orphans = nodes.filter((n) => n.degree === 0).length;
    return {
      components: sizeArr.length,
      orphans,
      largest: sizeArr.length ? Math.max(...sizeArr) : 0,
      inferred,
    };
  }, [nodes, links]);

  // initialise type filter once types are known
  useEffect(() => {
    if (enabledTypes === null && allTypes.length) setEnabledTypes(new Set(allTypes));
  }, [allTypes, enabledTypes]);

  const typeOn = (label: string) => enabledTypes === null || enabledTypes.has(label);
  const toggleType = (label: string) => {
    setEnabledTypes((prev) => {
      const base = prev ?? new Set(allTypes);
      const next = new Set(base);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // ── active view (filtered) ────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const visibleNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          typeOn(n.label) &&
          n.degree >= minDegree &&
          (!q || n.name.toLowerCase().includes(q) || n.label.toLowerCase().includes(q))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, enabledTypes, minDegree, q]
  );

  const graphData = useMemo(() => {
    const ids = new Set(visibleNodes.map((n) => n.id));
    const vlinks = links.filter(
      (l) =>
        ids.has(endId(l.source)) &&
        ids.has(endId(l.target)) &&
        (showInferred || !isInferred(l))
    );
    return {
      nodes: visibleNodes.map((n) => ({ ...n })),
      links: vlinks.map((l) => ({ source: endId(l.source), target: endId(l.target), rel_type: l.rel_type })),
    };
  }, [visibleNodes, links, showInferred]);

  const degreeMax = useMemo(() => nodes.reduce((m, n) => Math.max(m, n.degree), 1), [nodes]);

  // ── highlight the ego-network of the hovered/selected node ────────────────
  const activeId = hoverId ?? selected?.id ?? null;
  const { hlNodes, hlLinks } = useMemo(() => {
    const hlNodes = new Set<string>();
    const hlLinks = new Set<any>();
    if (activeId) {
      hlNodes.add(activeId);
      for (const l of graphData.links as any[]) {
        const s = endId(l.source);
        const t = endId(l.target);
        if (s === activeId || t === activeId) {
          hlLinks.add(l);
          hlNodes.add(s);
          hlNodes.add(t);
        }
      }
    }
    return { hlNodes, hlLinks };
  }, [activeId, graphData]);

  const resetView = () => {
    setSearch("");
    setMinDegree(0);
    setShowInferred(true);
    setEnabledTypes(new Set(allTypes));
    fgRef.current?.zoomToFit(500, 40);
  };

  // detail (from expansion)
  const selectedDetail: ExpandEntity | null =
    selected && expansion?.entities ? expansion.entities.find((e) => e.id === selected.id) ?? null : null;
  const hasProperties = selectedDetail?.properties && Object.keys(selectedDetail.properties).length > 0;

  if (loading)
    return <div className="flex h-64 items-center justify-center text-muted">Loading graph…</div>;

  const LABEL_DEG = 8; // always-on labels for hubs at this degree or above

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      {/* Header + live stats */}
      <h1 className="mb-1 text-2xl font-bold text-foreground">Knowledge Graph</h1>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span>
          <span className="text-foreground">{nodes.length.toLocaleString()}</span> entities
        </span>
        <span className="text-border-soft">·</span>
        <span>
          <span className="text-foreground">{links.length.toLocaleString()}</span> relationships
        </span>
        <span className="text-border-soft">·</span>
        <span>
          <span className="text-foreground">{allTypes.length}</span> types
        </span>
        <span className="text-border-soft">·</span>
        <span>
          <span className={stats.components === 1 ? "text-success" : "text-foreground"}>
            {stats.components}
          </span>{" "}
          component{stats.components === 1 ? "" : "s"}
        </span>
        <span className="text-border-soft">·</span>
        <span>
          <span className={stats.orphans === 0 ? "text-success" : "text-warning"}>{stats.orphans}</span>{" "}
          orphans
        </span>
        <span className="text-border-soft">·</span>
        <span>
          <span className="text-accent">{stats.inferred.toLocaleString()}</span> inferred
        </span>
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search entities…"
          className="min-w-[200px] flex-1 rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        {/* degree presets */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface px-1.5 py-1">
          <span className="px-1 text-[10px] uppercase tracking-wide text-muted">degree</span>
          {DEGREE_PRESETS.map((d) => (
            <button
              key={d.label}
              onClick={() => setMinDegree(d.min)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                minDegree === d.min ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        {/* inferred toggle */}
        <button
          onClick={() => setShowInferred((v) => !v)}
          title="Auto-generated similarity / co-occurrence links"
          className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
            showInferred
              ? "border-accent/40 bg-accent-soft text-accent"
              : "border-border bg-surface text-muted hover:text-foreground"
          }`}
        >
          {showInferred ? "Inferred: shown" : "Inferred: hidden"}
        </button>
        <button
          onClick={() => fgRef.current?.zoomToFit(500, 40)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted hover:text-foreground"
        >
          Fit
        </button>
        <button
          onClick={resetView}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted hover:text-foreground"
        >
          Reset
        </button>
      </div>

      {/* Type chips (legend = filter) */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {allTypes.map((label) => {
          const on = typeOn(label);
          return (
            <button
              key={label}
              onClick={() => toggleType(label)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                on ? "border-border bg-surface text-foreground" : "border-border/50 bg-transparent text-muted/50"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: typeColor(label), opacity: on ? 1 : 0.3 }}
              />
              {label}
              <span className="text-[10px] text-muted">{typeCounts[label]}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Graph */}
        <div
          className="relative overflow-hidden rounded-lg border border-border bg-surface lg:col-span-3"
          style={{ height: "72vh" }}
        >
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-background/70 px-2 py-1 text-[10px] text-muted backdrop-blur">
            showing {graphData.nodes.length} / {nodes.length} nodes · {graphData.links.length} edges
          </div>
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            cooldownTicks={120}
            nodeRelSize={5}
            nodeVal={(n: any) => Math.max(1.2, Math.sqrt(n.degree || 1) * 1.6)}
            nodeLabel={(n: any) => `${n.name} · ${n.label} · deg ${n.degree}`}
            nodeCanvasObjectMode={() => "replace"}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
              const r = Math.max(1.5, Math.sqrt(node.degree || 1) * 1.6);
              const dimmed = hlNodes.size > 0 && !hlNodes.has(node.id);
              const color = typeColor(node.label);
              ctx.beginPath();
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
              ctx.fillStyle = dimmed ? "rgba(120,120,140,0.18)" : color;
              ctx.fill();
              const focused = node.id === activeId;
              if (focused) {
                ctx.lineWidth = 2 / scale;
                ctx.strokeStyle = "#E9E9F2";
                ctx.stroke();
              }
              const showLabel =
                !dimmed && (hlNodes.has(node.id) || (node.degree >= LABEL_DEG && scale > 0.7));
              if (showLabel) {
                const fs = Math.max(10 / scale, 2.5);
                ctx.font = `${fs}px ui-sans-serif, system-ui, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillStyle = focused ? "#E9E9F2" : "rgba(201,201,217,0.85)";
                ctx.fillText(node.name, node.x, node.y + r + 1.5 / scale);
              }
            }}
            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
              const r = Math.max(1.5, Math.sqrt(node.degree || 1) * 1.6) + 2;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
              ctx.fill();
            }}
            linkColor={(l: any) => {
              if (hlLinks.has(l)) return "#8B7BFF";
              if (hlNodes.size > 0) return "rgba(60,60,75,0.18)";
              return isInferred(l) ? "rgba(90,90,115,0.30)" : "#3a3a46";
            }}
            linkLineDash={(l: any) => (isInferred(l) ? [2, 2] : null)}
            linkWidth={(l: any) => (hlLinks.has(l) ? 2 : 1)}
            linkDirectionalArrowLength={(l: any) => (isInferred(l) ? 0 : 3)}
            linkDirectionalArrowRelPos={0.85}
            onNodeHover={(node: any) => setHoverId(node ? node.id : null)}
            onNodeClick={(node: any) => selectNode(node)}
            onBackgroundClick={() => {
              setSelected(null);
              setExpansion(null);
            }}
          />
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-1">
          {selected ? (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs" style={{ color: typeColor(selected.label) }}>
                  {selected.label}
                </span>
                <button
                  onClick={() => {
                    setSelected(null);
                    setExpansion(null);
                  }}
                  className="text-xs text-muted hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <h3 className="mb-2 text-sm font-semibold text-foreground">{selected.name}</h3>

              <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                <span>degree {selected.degree}</span>
                {selectedDetail?.epistemic_status && (
                  <span
                    className={`rounded border border-current px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${epistemicColor(
                      selectedDetail.epistemic_status
                    )}`}
                  >
                    {selectedDetail.epistemic_status}
                  </span>
                )}
              </div>

              {selectedDetail?.valid_from && formatDate(selectedDetail.valid_from) && (
                <div className="mb-2 text-xs text-muted">
                  since <span className="text-foreground/70">{formatDate(selectedDetail.valid_from)}</span>
                </div>
              )}

              {hasProperties && (
                <div className="mb-3">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">Properties</div>
                  <div className="space-y-0.5">
                    {Object.entries(selectedDetail!.properties!).map(([pk, pv]) => (
                      <div key={pk} className="flex gap-1 text-[10px] text-foreground/70">
                        <span className="shrink-0 text-muted">{pk}:</span>
                        <span className="truncate">{String(pv)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-3 mt-1 flex items-center gap-2">
                <span className="text-[10px] text-muted">hops</span>
                {([1, 2, 3] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setK(n)}
                    className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                      k === n
                        ? "border-accent text-accent"
                        : "border-border text-muted hover:border-foreground/30 hover:text-foreground"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                {expandLoading && <span className="ml-1 text-[10px] text-muted">…</span>}
              </div>

              {expansion && expansion.edges?.length > 0 && (
                <div className="mt-1 border-t border-border pt-3">
                  <div className="mb-2 text-[10px] uppercase tracking-wide text-muted">
                    Connections · {expansion.edges.length}
                  </div>
                  <div className="max-h-[34vh] space-y-1 overflow-y-auto pr-1">
                    {expansion.edges.map((e, i) => {
                      const outgoing = e.src_entity_id === selected.id;
                      const otherId = outgoing ? e.dst_entity_id : e.src_entity_id;
                      const other = expansion.entities?.find((en) => en.id === otherId);
                      const otherName = other?.name ?? otherId ?? "?";
                      const inferredEdge = INFERRED_RELS.has(e.rel_type);
                      return (
                        <button
                          key={i}
                          onClick={() => other && selectNode({ id: other.id, name: other.name, label: other.label, degree: 0 })}
                          className="flex w-full items-center gap-1 text-left text-[10px] leading-relaxed text-foreground/80 hover:text-foreground"
                        >
                          <span className={inferredEdge ? "text-muted" : "text-accent"}>
                            {outgoing ? "→" : "←"} {e.rel_type}
                          </span>
                          <span className="text-border-soft">·</span>
                          <span className="truncate">{otherName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-4 text-center text-sm text-muted">
              Click a node to explore its neighbourhood.
              <div className="mt-3 space-y-1 text-left text-[10px] text-muted">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-px w-5 bg-[#3a3a46]" /> asserted relationship
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-px w-5"
                    style={{ borderTop: "1px dashed rgba(120,120,150,0.7)" }}
                  />{" "}
                  inferred (similarity / co-occurrence)
                </div>
                <div className="mt-1 text-muted/70">Node size = degree · colour = type.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
