"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/PageHeading";
import { getWorkspaceDetail } from "@/lib/curlyos";
import type { WorkspaceDetail } from "@/lib/curlyos-types";

export default function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<{ wsId: string }>;
}) {
  const { wsId } = use(params);
  const [data, setData] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getWorkspaceDetail(wsId)
      .then((d) => {
        if (!d || !d.workspace) setNotFound(true);
        else setData(d);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [wsId]);

  const ws = data?.workspace;
  const projects = data?.projects ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <nav className="mb-3 text-xs text-muted">
        <Link href="/workspaces" className="hover:text-foreground">Workspaces</Link>
        <span aria-hidden> / </span>
        <span className="text-foreground">{ws?.name ?? "…"}</span>
      </nav>

      {notFound ? (
        <div className="rounded-lg border border-border bg-surface p-10 text-center text-sm text-muted">
          Workspace not found.
        </div>
      ) : (
        <>
          <PageHeading
            title={ws?.name ?? "Workspace"}
            eyebrow="Workspace"
            subtitle={
              loading
                ? "Loading…"
                : ws?.summary ?? `${projects.length} project${projects.length !== 1 ? "s" : ""}`
            }
          />

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-surface" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface/50 p-10 text-center text-sm text-muted">
              No projects yet. The orchestrator creates one when it places a goal here.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/workspaces/${wsId}/${p.id}`}
                  className="group rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-accent">
                      {p.name}
                    </h2>
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                        p.status === "active"
                          ? "border-green-400/30 bg-green-400/10 text-green-400"
                          : "border-border bg-surface-2 text-muted"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  {p.summary && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{p.summary}</p>}
                  <div className="mt-3 flex items-center gap-3 font-mono text-[10px] text-muted">
                    <span>◎ {p.goal_count} goal{p.goal_count !== 1 ? "s" : ""}</span>
                    <span>📦 {p.artifact_count} artifact{p.artifact_count !== 1 ? "s" : ""}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
