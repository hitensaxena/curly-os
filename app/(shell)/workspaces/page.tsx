"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/PageHeading";
import { getWorkspaces } from "@/lib/curlyos";
import type { Workspace } from "@/lib/curlyos-types";

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWorkspaces()
      .then((d) => setWorkspaces(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Workspaces"
        eyebrow="Where work lives"
        subtitle={
          loading
            ? "Loading…"
            : workspaces.length === 0
            ? "No workspaces yet"
            : `${workspaces.length} workspace${workspaces.length !== 1 ? "s" : ""} · each holds projects, goals, and the things agents make`
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-10 text-center">
          <div className="mb-3 text-4xl">▢</div>
          <h2 className="mb-1 text-base font-semibold text-foreground">No workspaces yet</h2>
          <p className="mx-auto max-w-sm text-sm text-muted">
            Workspaces appear automatically when the orchestrator starts working on a goal —
            it places each goal into a project inside a workspace. Create a goal in{" "}
            <Link href="/goals" className="text-accent hover:underline">Goals</Link> to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {workspaces.map((ws) => (
            <Link
              key={ws.id}
              href={`/workspaces/${ws.id}`}
              className="group rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground group-hover:text-accent">
                  {ws.name}
                </h2>
                <span className="shrink-0 rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-muted">
                  {ws.project_count} project{ws.project_count !== 1 ? "s" : ""}
                </span>
              </div>
              {ws.summary && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{ws.summary}</p>}
              <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-muted">
                {ws.kind && (
                  <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5">{ws.kind}</span>
                )}
                {ws.slug && <span className="truncate">/{ws.slug}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
