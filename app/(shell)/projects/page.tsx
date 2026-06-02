import Link from "next/link";
import { listProjects, registryExists } from "@/lib/projects";
import { Card } from "@/components/ui/Card";
import { NewProjectButton } from "@/components/projects/NewProjectButton";
import { PageHeading } from "@/components/ui/PageHeading";

export const dynamic = "force-dynamic";

function statusStyle(s: string): string {
  if (s === "active") return "text-success border-success/40";
  if (s === "paused") return "text-warning border-warning/40";
  return "text-muted border-border";
}

export default async function ProjectsPage() {
  const [projects, hasRegistry] = await Promise.all([listProjects(), registryExists()]);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Projects"
        subtitle="Work on what matters, with your brain behind you."
        actions={<NewProjectButton hasRegistry={hasRegistry} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {projects.map((p) => (
          <Card key={p.slug} as={Link} href={`/projects/${p.slug}`} interactive padding="loose">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-foreground">{p.name}</span>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusStyle(p.status)}`}
              >
                {p.status}
              </span>
            </div>
            {p.summary && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{p.summary}</p>}
            {!p.dir && <p className="mt-1.5 text-[11px] text-muted">no folder yet</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
