"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/PageHeading";
import { ArtifactList } from "@/components/hierarchy/ArtifactList";
import { ProjectChat } from "@/components/hierarchy/ProjectChat";
import { getProjectDetail } from "@/lib/curlyos";
import { useEventStream } from "@/lib/use-event-stream";
import type { ProjectDetail, ProjectGoal } from "@/lib/curlyos-types";

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-[10px] text-muted">{pct}%</span>
    </div>
  );
}

const GOAL_STATUS: Record<string, string> = {
  active: "text-accent border-accent/30 bg-accent/10",
  achieved: "text-green-400 border-green-400/30 bg-green-400/10",
  paused: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  abandoned: "text-muted border-border bg-surface-2",
};

function GoalRow({ goal, isNorthStar, basePath }: { goal: ProjectGoal; isNorthStar: boolean; basePath: string }) {
  return (
    <Link
      href={`${basePath}/${encodeURIComponent(goal.id)}`}
      className="group block rounded-lg border border-border bg-surface p-3 transition-colors hover:border-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {isNorthStar && <span title="North-star goal" className="shrink-0 text-amber-400">★</span>}
          <p className="truncate text-sm font-medium text-foreground group-hover:text-accent">{goal.title}</p>
        </div>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] ${GOAL_STATUS[goal.status] ?? GOAL_STATUS.abandoned}`}>
          {goal.status}
        </span>
      </div>
      <div className="mt-2 w-48"><ProgressBar value={goal.progress} /></div>
      {goal.success_criteria && (
        <p className="mt-1.5 line-clamp-1 text-[11px] text-muted">{goal.success_criteria}</p>
      )}
    </Link>
  );
}

export default function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ wsId: string; projectId: string }>;
}) {
  const { wsId, projectId } = use(params);
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const reload = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    getProjectDetail(projectId)
      .then((d) => {
        if (!d || !d.project) setNotFound(true);
        else setData(d);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // Live refresh as workers produce artifacts / advance goals.
  useEventStream(["agent", "goal"], () => {
    if (reload.current) clearTimeout(reload.current);
    reload.current = setTimeout(load, 800);
  });

  const project = data?.project;
  const goals = data?.goals ?? [];
  const artifacts = data?.artifacts ?? [];
  const northStarId = project?.north_star_goal_id ?? null;
  const basePath = `/workspaces/${wsId}/${projectId}`;
  // The project chat anchors on the north-star goal, else the first goal.
  const anchorGoalId = northStarId ?? goals[0]?.id ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted">
        <Link href="/workspaces" className="hover:text-foreground">Workspaces</Link>
        <span aria-hidden>/</span>
        <Link href={`/workspaces/${wsId}`} className="hover:text-foreground">
          {project?.workspace_name ?? "Workspace"}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">{project?.name ?? "…"}</span>
      </nav>

      {notFound ? (
        <div className="rounded-lg border border-border bg-surface p-10 text-center text-sm text-muted">
          Project not found.
        </div>
      ) : (
        <>
          <PageHeading
            title={project?.name ?? "Project"}
            eyebrow="Project"
            subtitle={loading ? "Loading…" : project?.summary ?? `${goals.length} goal${goals.length !== 1 ? "s" : ""} · ${artifacts.length} artifact${artifacts.length !== 1 ? "s" : ""}`}
          />

          {project?.path && (
            <p className="mb-6 -mt-2 font-mono text-[11px] text-muted">{project.path}</p>
          )}

          {/* Chat (left) + Goals (right) */}
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            <section>
              <ProjectChat anchorGoalId={anchorGoalId} />
            </section>

            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Goals ({goals.length})
              </h3>
              {loading ? (
                <div className="space-y-2.5">
                  {[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-surface" />)}
                </div>
              ) : goals.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-surface/50 p-6 text-center text-sm text-muted">
                  No goals placed here yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {goals.map((g) => (
                    <GoalRow key={g.id} goal={g} isNorthStar={g.id === northStarId} basePath={basePath} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Studio — tangible deliverables across the project */}
          <section className="mt-8">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Studio · deliverables ({artifacts.length})
            </h3>
            {loading ? (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-surface" />)}
              </div>
            ) : (
              <ArtifactList artifacts={artifacts} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
