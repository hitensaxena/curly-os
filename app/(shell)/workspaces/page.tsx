"use client";

import { useEffect, useState, useRef } from "react";
import { PageHeading } from "@/components/ui/PageHeading";

const API = "";

interface Workspace {
  id: string;
  scope: string | null;
  name: string;
  kind: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  workspace_id: string;
  name: string;
  status: string;
  properties: Record<string, unknown> | null;
  created_at: string;
}

function StatusChip({ status }: { status: string }) {
  const color =
    status === "active"
      ? "text-green-400 bg-green-400/10 border-green-400/30"
      : status === "archived"
      ? "text-muted bg-surface-2 border-border"
      : "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono ${color}`}
    >
      {status}
    </span>
  );
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsCount, setWsCount] = useState(0);
  const [wsLoading, setWsLoading] = useState(true);

  const [selected, setSelected] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projLoading, setProjLoading] = useState(false);

  // New workspace form
  const [showNewWs, setShowNewWs] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsKind, setNewWsKind] = useState("");
  const [wsSaving, setWsSaving] = useState(false);

  // New project form
  const [showNewProj, setShowNewProj] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [projSaving, setProjSaving] = useState(false);

  const wsNameRef = useRef<HTMLInputElement>(null);
  const projNameRef = useRef<HTMLInputElement>(null);

  // ── load workspaces ────────────────────────────────────────────────────────
  const loadWorkspaces = () => {
    setWsLoading(true);
    fetch(`${API}/api/workspaces`)
      .then((r) => r.json())
      .then((d) => {
        setWorkspaces(d.items || []);
        setWsCount(d.count ?? (d.items || []).length);
        setWsLoading(false);
      })
      .catch(() => setWsLoading(false));
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  // ── load projects for selected workspace ──────────────────────────────────
  const loadProjects = (wsId: string) => {
    setProjLoading(true);
    setProjects([]);
    fetch(`${API}/api/projects?workspace_id=${encodeURIComponent(wsId)}`)
      .then((r) => r.json())
      .then((d) => {
        setProjects(d.items || []);
        setProjLoading(false);
      })
      .catch(() => {
        setProjects([]);
        setProjLoading(false);
      });
  };

  const selectWorkspace = (ws: Workspace) => {
    setSelected(ws);
    setShowNewProj(false);
    setNewProjName("");
    loadProjects(ws.id);
  };

  // ── create workspace ──────────────────────────────────────────────────────
  const createWorkspace = async () => {
    const name = newWsName.trim();
    if (!name) return;
    setWsSaving(true);
    try {
      const body: { name: string; kind?: string } = { name };
      if (newWsKind.trim()) body.kind = newWsKind.trim();
      const res = await fetch(`${API}/api/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const created: Workspace = await res.json();
        setNewWsName("");
        setNewWsKind("");
        setShowNewWs(false);
        // refetch list, then auto-select new workspace
        fetch(`${API}/api/workspaces`)
          .then((r) => r.json())
          .then((d) => {
            const items: Workspace[] = d.items || [];
            setWorkspaces(items);
            setWsCount(d.count ?? items.length);
            const ws = items.find((w) => w.id === created.id) ?? created;
            selectWorkspace(ws);
          })
          .catch(() => {
            loadWorkspaces();
          });
      }
    } finally {
      setWsSaving(false);
    }
  };

  // ── create project ────────────────────────────────────────────────────────
  const createProject = async () => {
    if (!selected) return;
    const name = newProjName.trim();
    if (!name) return;
    setProjSaving(true);
    try {
      const res = await fetch(`${API}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: selected.id, name }),
      });
      if (res.ok) {
        setNewProjName("");
        setShowNewProj(false);
        loadProjects(selected.id);
      }
    } finally {
      setProjSaving(false);
    }
  };

  // ── keyboard shortcuts in forms ───────────────────────────────────────────
  const onWsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") createWorkspace();
    if (e.key === "Escape") {
      setShowNewWs(false);
      setNewWsName("");
      setNewWsKind("");
    }
  };

  const onProjKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") createProject();
    if (e.key === "Escape") {
      setShowNewProj(false);
      setNewProjName("");
    }
  };

  // auto-focus when forms open
  useEffect(() => {
    if (showNewWs) wsNameRef.current?.focus();
  }, [showNewWs]);

  useEffect(() => {
    if (showNewProj) projNameRef.current?.focus();
  }, [showNewProj]);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Workspaces"
        subtitle={
          wsLoading
            ? "Loading..."
            : wsCount === 0
            ? "No workspaces yet"
            : `${wsCount} workspace${wsCount !== 1 ? "s" : ""} in curlyos-core`
        }
        eyebrow="curlyos-core"
        actions={
          !wsLoading && workspaces.length > 0 ? (
            <button
              onClick={() => {
                setShowNewWs((v) => !v);
              }}
              className="rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20"
            >
              + New workspace
            </button>
          ) : undefined
        }
      />

      {/* ── empty state (no workspaces) ── */}
      {!wsLoading && workspaces.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <div className="text-4xl mb-3">&#9633;</div>
          <h2 className="text-base font-semibold text-foreground mb-1">
            No workspaces yet
          </h2>
          <p className="text-sm text-muted mb-6 max-w-sm mx-auto">
            Workspaces group related projects in curlyos-core. Create your first
            workspace to get started.
          </p>

          {!showNewWs ? (
            <button
              onClick={() => setShowNewWs(true)}
              className="rounded-lg border border-accent bg-accent/10 px-5 py-2.5 text-sm text-accent hover:bg-accent/20"
            >
              + New workspace
            </button>
          ) : (
            <div className="max-w-sm mx-auto rounded-lg border border-border bg-surface-2 p-4 text-left">
              <p className="text-xs text-muted mb-3 font-semibold uppercase tracking-wide">
                Create workspace
              </p>
              <input
                ref={wsNameRef}
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                onKeyDown={onWsKeyDown}
                placeholder="Workspace name"
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted mb-2 focus:outline-none focus:border-accent"
              />
              <input
                value={newWsKind}
                onChange={(e) => setNewWsKind(e.target.value)}
                onKeyDown={onWsKeyDown}
                placeholder="Kind (optional, e.g. personal)"
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted mb-3 focus:outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <button
                  onClick={createWorkspace}
                  disabled={wsSaving || !newWsName.trim()}
                  className="rounded bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/80 disabled:opacity-40"
                >
                  {wsSaving ? "Creating..." : "Create"}
                </button>
                <button
                  onClick={() => {
                    setShowNewWs(false);
                    setNewWsName("");
                    setNewWsKind("");
                  }}
                  className="rounded border border-border px-4 py-1.5 text-sm text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── inline new-workspace form (when list is not empty) ── */}
      {!wsLoading && workspaces.length > 0 && showNewWs && (
        <div className="rounded-lg border border-border bg-surface p-4 mb-5">
          <p className="text-xs text-muted mb-3 font-semibold uppercase tracking-wide">
            Create workspace
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input
              ref={wsNameRef}
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              onKeyDown={onWsKeyDown}
              placeholder="Workspace name"
              className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
            />
            <input
              value={newWsKind}
              onChange={(e) => setNewWsKind(e.target.value)}
              onKeyDown={onWsKeyDown}
              placeholder="Kind (optional)"
              className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createWorkspace}
              disabled={wsSaving || !newWsName.trim()}
              className="rounded bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/80 disabled:opacity-40"
            >
              {wsSaving ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setShowNewWs(false);
                setNewWsName("");
                setNewWsKind("");
              }}
              className="rounded border border-border px-4 py-1.5 text-sm text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── main master-detail grid ── */}
      {!wsLoading && workspaces.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── left: workspace list ── */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-border bg-surface divide-y divide-border">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => selectWorkspace(ws)}
                  className={`w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors ${
                    selected?.id === ws.id
                      ? "bg-surface-2 border-l-2 border-accent"
                      : ""
                  }`}
                >
                  <p className="text-sm font-medium text-foreground truncate">
                    {ws.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {ws.kind && (
                      <span className="text-[10px] text-muted bg-surface-2 border border-border rounded px-1.5 py-0.5 font-mono">
                        {ws.kind}
                      </span>
                    )}
                    {ws.scope && (
                      <span className="text-[10px] text-accent font-mono">
                        {ws.scope}
                      </span>
                    )}
                    <span className="text-[10px] text-muted">
                      {new Date(ws.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── right: detail panel ── */}
          <div className="lg:col-span-3">
            {!selected ? (
              <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted">
                Select a workspace to view its projects
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-surface p-5 sticky top-4">
                {/* workspace header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      {selected.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {selected.kind && (
                        <span className="text-[10px] text-muted bg-surface-2 border border-border rounded px-1.5 py-0.5 font-mono">
                          {selected.kind}
                        </span>
                      )}
                      {selected.scope && (
                        <span className="text-[10px] text-accent font-mono">
                          {selected.scope}
                        </span>
                      )}
                      <span className="text-[10px] text-muted font-mono">
                        {selected.id.slice(0, 16)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelected(null);
                      setProjects([]);
                      setShowNewProj(false);
                    }}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    &#x2715;
                  </button>
                </div>

                {/* projects section */}
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Projects
                    </span>
                    {!showNewProj && (
                      <button
                        onClick={() => setShowNewProj(true)}
                        className="text-xs text-accent hover:text-accent/80"
                      >
                        + New project
                      </button>
                    )}
                  </div>

                  {/* new project form */}
                  {showNewProj && (
                    <div className="rounded border border-border bg-surface-2 p-3 mb-3">
                      <input
                        ref={projNameRef}
                        value={newProjName}
                        onChange={(e) => setNewProjName(e.target.value)}
                        onKeyDown={onProjKeyDown}
                        placeholder="Project name"
                        className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted mb-2 focus:outline-none focus:border-accent"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={createProject}
                          disabled={projSaving || !newProjName.trim()}
                          className="rounded bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent/80 disabled:opacity-40"
                        >
                          {projSaving ? "Creating..." : "Create"}
                        </button>
                        <button
                          onClick={() => {
                            setShowNewProj(false);
                            setNewProjName("");
                          }}
                          className="rounded border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* project list */}
                  {projLoading ? (
                    <div className="text-xs text-muted py-2">Loading...</div>
                  ) : projects.length === 0 ? (
                    <div className="text-xs text-muted py-2">
                      No projects in this workspace yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border rounded border border-border">
                      {projects.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 px-3 py-2.5"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-muted mt-0.5">
                              {new Date(p.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <StatusChip status={p.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
