"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PROJECT_TYPES, type ProjectType } from "@/lib/project-types";

type ProjectCard = {
  slug: string;
  name: string;
  status: string;
  dir: string | null;
  summary: string;
  type: ProjectType;
  emoji: string | null;
  archived: boolean;
};

function statusStyle(s: string): string {
  if (s === "active") return "text-success border-success/40";
  if (s === "paused") return "text-warning border-warning/40";
  if (s === "merged") return "text-accent border-accent/40";
  return "text-muted border-border";
}

export function ProjectsGrid({ projects }: { projects: ProjectCard[] }) {
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = projects.filter((p) => p.archived).length;
  const visible = projects.filter((p) => showArchived || !p.archived);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((p) => (
          <Card key={p.slug} as={Link} href={`/projects/${p.slug}`} interactive padding="loose">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="shrink-0 text-base leading-none">
                  {p.emoji || PROJECT_TYPES[p.type].emoji}
                </span>
                <span className="truncate font-medium text-foreground">{p.name}</span>
              </span>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusStyle(p.status)}`}
              >
                {p.status}
              </span>
            </div>
            {p.summary && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{p.summary}</p>}
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
              <span className="rounded border border-border px-1.5 py-0.5">{PROJECT_TYPES[p.type].label}</span>
              {!p.dir && <span>no folder yet</span>}
            </div>
          </Card>
        ))}
      </div>

      {archivedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="mt-4 text-xs text-muted hover:text-foreground hover:underline"
        >
          {showArchived ? "Hide" : "Show"} archived ({archivedCount})
        </button>
      )}
    </>
  );
}
