"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GoalWorkspace } from "@/components/orchestrator/GoalWorkspace";
import { getProjectDetail } from "@/lib/curlyos";
import type { ProjectDetail, ProjectGoal } from "@/lib/curlyos-types";

export default function GoalDetailPage({
  params,
}: {
  params: Promise<{ wsId: string; projectId: string; goalId: string }>;
}) {
  const { wsId, projectId, goalId } = use(params);
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getProjectDetail(projectId)
      .then((d) => setData(d && d.project ? d : null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const project = data?.project;
  const goal: ProjectGoal | undefined = data?.goals.find((g) => g.id === goalId);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted">
        <Link href="/workspaces" className="hover:text-foreground">Workspaces</Link>
        <span aria-hidden>/</span>
        <Link href={`/workspaces/${wsId}`} className="hover:text-foreground">
          {project?.workspace_name ?? "Workspace"}
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/workspaces/${wsId}/${projectId}`} className="hover:text-foreground">
          {project?.name ?? "Project"}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">{goal?.title ?? "Goal"}</span>
      </nav>

      {loading ? (
        <div className="h-96 animate-pulse rounded-lg border border-border bg-surface" />
      ) : !goal ? (
        <div className="rounded-lg border border-border bg-surface p-10 text-center text-sm text-muted">
          Goal not found in this project.
        </div>
      ) : (
        <GoalWorkspace
          key={goalId}
          goalId={goal.id}
          title={goal.title}
          progress={goal.progress}
          onChanged={load}
        />
      )}
    </div>
  );
}
