"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/ui/PageHeading";

const API = "";

interface Studio {
  id: string;
  scope: string | null;
  title: string;
  status: string;
  properties: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  sketchCount?: number;
}

interface Sketch {
  id: string;
  studio_id: string;
  content: string;
  kind: string | null;
  epistemic_status: string;
  properties: Record<string, unknown> | null;
  created_at: string;
}

interface SketchLink {
  id: string;
  src_sketch_id: string;
  dst_sketch_id: string;
  rel_type: string;
}

interface StudioDetail {
  studio: Studio;
  sketches: Sketch[];
  links: SketchLink[];
}

const EPISTEMIC_STATUSES = ["seed", "conjecture", "hypothesis"] as const;
type EpistemicStatus = (typeof EPISTEMIC_STATUSES)[number];

const EPISTEMIC_COLOR: Record<EpistemicStatus, string> = {
  seed: "text-orange-400",
  conjecture: "text-yellow-400",
  hypothesis: "text-blue-400",
};

const EPISTEMIC_BORDER: Record<EpistemicStatus, string> = {
  seed: "border-orange-400/30",
  conjecture: "border-yellow-400/30",
  hypothesis: "border-blue-400/30",
};

// seed → conjecture → hypothesis; hypothesis exits the studio via graduation
const NEXT_STATUS: Partial<Record<EpistemicStatus, EpistemicStatus>> = {
  seed: "conjecture",
  conjecture: "hypothesis",
};

export default function StudioPage() {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Studio | null>(null);
  const [detail, setDetail] = useState<StudioDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create studio form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // Add sketch form
  const [showAddSketch, setShowAddSketch] = useState(false);
  const [sketchContent, setSketchContent] = useState("");
  const [sketchKind, setSketchKind] = useState("");
  const [addingSketch, setAddingSketch] = useState(false);

  // Promote / graduate
  const [busySketchId, setBusySketchId] = useState<string | null>(null);
  const [sketchError, setSketchError] = useState("");

  const loadStudios = () => {
    setLoading(true);
    fetch(`${API}/api/studio`)
      .then((r) => r.json())
      .catch(() => ({ items: [], count: 0 }))
      .then((d) => {
        setStudios(d.items || []);
        setTotal(d.count || 0);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadStudios();
  }, []);

  const selectStudio = (s: Studio) => {
    setSelected(s);
    setDetail(null);
    setDetailLoading(true);
    setShowAddSketch(false);
    setSketchContent("");
    setSketchKind("");
    fetch(`${API}/api/studio/${s.id}`)
      .then((r) => r.json())
      .catch(() => null)
      .then((d) => {
        if (d) {
          setDetail(d);
          // Update sketch count on the list item
          setStudios((prev) =>
            prev.map((item) =>
              item.id === s.id
                ? { ...item, sketchCount: (d.sketches || []).length }
                : item
            )
          );
        }
        setDetailLoading(false);
      });
  };

  const createStudio = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await fetch(`${API}/api/studio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      setNewTitle("");
      setShowCreate(false);
      loadStudios();
    } catch {
      // silently fail — UI stays consistent
    } finally {
      setCreating(false);
    }
  };

  const addSketch = async () => {
    if (!sketchContent.trim() || !selected) return;
    setAddingSketch(true);
    try {
      await fetch(`${API}/api/studio/${selected.id}/sketch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: sketchContent.trim(),
          ...(sketchKind.trim() ? { kind: sketchKind.trim() } : {}),
        }),
      });
      setSketchContent("");
      setSketchKind("");
      setShowAddSketch(false);
      // Refetch detail
      selectStudio(selected);
    } catch {
      // silently fail
    } finally {
      setAddingSketch(false);
    }
  };

  const promoteSketch = async (sk: Sketch) => {
    const next = NEXT_STATUS[sk.epistemic_status as EpistemicStatus];
    if (!next || !selected) return;
    setBusySketchId(sk.id);
    setSketchError("");
    try {
      const r = await fetch(`${API}/api/studio/sketch/${sk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ epistemic_status: next }),
      });
      if (!r.ok) throw new Error((await r.json()).detail ?? r.statusText);
      selectStudio(selected);
    } catch (e) {
      setSketchError(e instanceof Error ? e.message : "Failed to promote.");
    } finally {
      setBusySketchId(null);
    }
  };

  const graduateSketch = async (sk: Sketch) => {
    if (!selected) return;
    setBusySketchId(sk.id);
    setSketchError("");
    try {
      const r = await fetch(`${API}/api/studio/sketch/${sk.id}/graduate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error((await r.json()).detail ?? r.statusText);
      selectStudio(selected);
    } catch (e) {
      setSketchError(e instanceof Error ? e.message : "Failed to graduate.");
    } finally {
      setBusySketchId(null);
    }
  };

  const isEmpty = !loading && studios.length === 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Studio"
        eyebrow="idea canvas"
        subtitle={isEmpty ? undefined : `${total} studio${total !== 1 ? "s" : ""}`}
        actions={
          !isEmpty ? (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20"
            >
              + New Studio
            </button>
          ) : undefined
        }
      />

      {/* Inline create form (when list is non-empty and button clicked) */}
      {!isEmpty && showCreate && (
        <div className="rounded-lg border border-border bg-surface p-4 mb-6">
          <div className="flex gap-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createStudio()}
              placeholder="Studio title…"
              className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
              autoFocus
            />
            <button
              onClick={createStudio}
              disabled={creating || !newTitle.trim()}
              className="rounded bg-accent px-4 py-2 text-sm text-white hover:bg-accent/80 disabled:opacity-40"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewTitle(""); }}
              className="rounded border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-muted text-sm">Loading…</div>
      ) : isEmpty ? (
        /* ── Empty state ── */
        <div className="rounded-lg border border-border bg-surface p-8 text-center max-w-lg mx-auto mt-12">
          <p className="text-base font-semibold text-foreground mb-2">Your idea canvas is empty</p>
          <p className="text-sm text-muted mb-6 leading-relaxed">
            Studio is your idea canvas — capture rough sketches as{" "}
            <span className="text-orange-400 font-mono">seeds</span>, then develop them up the
            epistemic ladder:{" "}
            <span className="text-orange-400 font-mono">seed</span>
            {" → "}
            <span className="text-yellow-400 font-mono">conjecture</span>
            {" → "}
            <span className="text-blue-400 font-mono">hypothesis</span>.
          </p>
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg border border-accent bg-accent/10 px-6 py-2.5 text-sm text-accent hover:bg-accent/20"
            >
              + New Studio
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createStudio()}
                placeholder="Studio title…"
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
                autoFocus
              />
              <div className="flex gap-2 justify-center">
                <button
                  onClick={createStudio}
                  disabled={creating || !newTitle.trim()}
                  className="rounded bg-accent px-5 py-2 text-sm text-white hover:bg-accent/80 disabled:opacity-40"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
                <button
                  onClick={() => { setShowCreate(false); setNewTitle(""); }}
                  className="rounded border border-border px-5 py-2 text-sm text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Master-detail layout ── */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: studio list */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-border bg-surface divide-y divide-border">
              {studios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectStudio(s)}
                  className={`w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors ${
                    selected?.id === s.id ? "bg-surface-2 border-l-2 border-accent" : ""
                  }`}
                >
                  <p className="text-sm text-foreground font-medium line-clamp-1">{s.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-muted font-mono">{s.id.slice(0, 8)}</span>
                    {s.status && (
                      <span className="text-[10px] text-muted bg-surface-2 border border-border rounded px-1.5 py-0.5 font-mono">
                        {s.status}
                      </span>
                    )}
                    {s.sketchCount !== undefined && (
                      <span className="text-[10px] text-muted">
                        {s.sketchCount} sketch{s.sketchCount !== 1 ? "es" : ""}
                      </span>
                    )}
                    <span className="text-[10px] text-muted">
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: detail */}
          <div className="lg:col-span-3">
            {!selected ? (
              <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted text-center">
                Select a studio to view its sketches
              </div>
            ) : detailLoading ? (
              <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">
                Loading…
              </div>
            ) : detail ? (
              <div className="rounded-lg border border-border bg-surface p-5">
                {/* Detail header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{detail.studio.title}</h2>
                    <span className="text-[10px] text-muted font-mono">{detail.studio.id.slice(0, 20)}</span>
                  </div>
                  <button
                    onClick={() => { setSelected(null); setDetail(null); }}
                    className="text-xs text-muted hover:text-foreground shrink-0 ml-2"
                  >
                    ✕
                  </button>
                </div>

                {sketchError && (
                  <p className="mb-3 text-xs text-red-400">{sketchError}</p>
                )}

                {/* Epistemic ladder */}
                {detail.sketches.length === 0 ? (
                  <p className="text-sm text-muted mb-4">No sketches yet — add the first one below.</p>
                ) : (
                  <div className="space-y-4 mb-4">
                    {EPISTEMIC_STATUSES.map((status) => {
                      const bucket = detail.sketches.filter(
                        (sk) => sk.epistemic_status === status
                      );
                      if (bucket.length === 0) return null;
                      return (
                        <div key={status}>
                          <h3
                            className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${EPISTEMIC_COLOR[status]}`}
                          >
                            {status} ({bucket.length})
                          </h3>
                          <div className={`space-y-2 pl-3 border-l-2 ${EPISTEMIC_BORDER[status]}`}>
                            {bucket.map((sk) => (
                              <div
                                key={sk.id}
                                className="rounded border border-border bg-surface-2 px-3 py-2"
                              >
                                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                  {sk.content}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <span className="text-[10px] text-muted font-mono">
                                    {sk.id.slice(0, 8)}
                                  </span>
                                  {sk.kind && (
                                    <span className="text-[10px] text-muted bg-surface border border-border rounded px-1.5 py-0.5 font-mono">
                                      {sk.kind}
                                    </span>
                                  )}
                                  {typeof sk.properties?.graduated_to === "string" ? (
                                    <a
                                      href="/projects"
                                      className="text-[10px] font-mono rounded border border-green-400/30 bg-green-400/10 text-green-400 px-1.5 py-0.5 hover:bg-green-400/20"
                                      title={String(sk.properties.graduated_to)}
                                    >
                                      graduated ↗ {String(sk.properties.graduated_to).slice(0, 12)}
                                    </a>
                                  ) : (
                                    <span className="ml-auto flex items-center gap-1.5">
                                      {NEXT_STATUS[sk.epistemic_status as EpistemicStatus] && (
                                        <button
                                          onClick={() => promoteSketch(sk)}
                                          disabled={busySketchId === sk.id}
                                          className={`text-[10px] rounded border border-border px-1.5 py-0.5 text-muted hover:text-foreground hover:border-accent disabled:opacity-40 ${
                                            EPISTEMIC_COLOR[NEXT_STATUS[sk.epistemic_status as EpistemicStatus]!]
                                          }`}
                                          title={`Promote to ${NEXT_STATUS[sk.epistemic_status as EpistemicStatus]}`}
                                        >
                                          {busySketchId === sk.id
                                            ? "…"
                                            : `↑ ${NEXT_STATUS[sk.epistemic_status as EpistemicStatus]}`}
                                        </button>
                                      )}
                                      {(sk.epistemic_status === "conjecture" ||
                                        sk.epistemic_status === "hypothesis") && (
                                        <button
                                          onClick={() => graduateSketch(sk)}
                                          disabled={busySketchId === sk.id}
                                          className="text-[10px] rounded border border-green-400/40 bg-green-400/5 px-1.5 py-0.5 text-green-400 hover:bg-green-400/15 disabled:opacity-40"
                                          title="Graduate into a project — the only way out of the studio"
                                        >
                                          {busySketchId === sk.id ? "…" : "graduate ↗"}
                                        </button>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inter-sketch links */}
                {detail.links.length > 0 && (
                  <div className="border-t border-border pt-3 mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
                      Links ({detail.links.length})
                    </p>
                    <div className="space-y-1">
                      {detail.links.map((lk) => (
                        <div key={lk.id} className="text-[11px] text-muted font-mono">
                          {lk.src_sketch_id.slice(0, 8)} —{lk.rel_type}→ {lk.dst_sketch_id.slice(0, 8)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add sketch */}
                {!showAddSketch ? (
                  <button
                    onClick={() => setShowAddSketch(true)}
                    className="w-full rounded border border-dashed border-border py-2 text-sm text-muted hover:text-foreground hover:border-accent transition-colors"
                  >
                    + Add sketch
                  </button>
                ) : (
                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted mb-2 font-semibold uppercase tracking-wide">
                      New Sketch
                    </p>
                    <textarea
                      value={sketchContent}
                      onChange={(e) => setSketchContent(e.target.value)}
                      placeholder="Sketch content… (starts as seed)"
                      rows={4}
                      className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent resize-none mb-2"
                    />
                    <input
                      value={sketchKind}
                      onChange={(e) => setSketchKind(e.target.value)}
                      placeholder="Kind (optional: note, question, observation…)"
                      className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent mb-3"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={addSketch}
                        disabled={addingSketch || !sketchContent.trim()}
                        className="rounded bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/80 disabled:opacity-40"
                      >
                        {addingSketch ? "Adding…" : "Add Sketch"}
                      </button>
                      <button
                        onClick={() => { setShowAddSketch(false); setSketchContent(""); setSketchKind(""); }}
                        className="rounded border border-border px-4 py-1.5 text-sm text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted text-center">
                Failed to load studio detail.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
