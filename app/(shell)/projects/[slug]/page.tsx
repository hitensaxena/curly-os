import { notFound } from "next/navigation";
import Link from "next/link";
import { getProject } from "@/lib/projects";
import { readVaultNote, searchVaultContent } from "@/lib/vault-fs";
import { parseTasks, type Task } from "@/lib/tasks";
import { noteHref } from "@/lib/vault-paths";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TaskList } from "@/components/projects/TaskList";
import { ProjectCapture } from "@/components/projects/ProjectCapture";
import { ScaffoldButton } from "@/components/projects/ScaffoldButton";
import { ProjectMetaEditor } from "@/components/projects/ProjectMetaEditor";
import { PROJECT_TYPES } from "@/lib/project-types";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  let tasks: Task[] = [];
  if (project.dir) {
    const t = await readVaultNote(`${project.dir}/tasks.md`);
    if (t) tasks = parseTasks(t.raw);
  }
  const related = await searchVaultContent(project.name, 12).catch(() => []);
  const runHref = `/agent?task=${encodeURIComponent(`Work on project "${project.name}": `)}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <nav className="mb-3 text-xs text-muted">
        <Link href="/projects" className="hover:text-foreground">
          Projects
        </Link>
        <span aria-hidden> / </span>
        <span className="text-foreground">{project.name}</span>
      </nav>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <span aria-hidden className="text-2xl leading-none">{project.emoji || PROJECT_TYPES[project.type].emoji}</span>
            <span className="truncate">{project.name}</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <span className="rounded border border-border px-1.5 py-0.5">{PROJECT_TYPES[project.type].label}</span>
            <span className="rounded border border-border px-1.5 py-0.5 uppercase tracking-wide">{project.status}</span>
            {project.codeDir && (
              <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">{project.codeDir}</span>
            )}
            {project.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="rounded border border-border px-1.5 py-0.5 text-accent hover:underline">
                {l.label} ↗
              </a>
            ))}
          </div>
          {project.summary && <p className="mt-2 text-sm text-subtle">{project.summary}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ProjectMetaEditor
            project={{
              slug: project.slug,
              name: project.name,
              summary: project.summary,
              status: project.status,
              type: project.type,
              codeDir: project.codeDir,
              emoji: project.emoji,
              links: project.links,
              archived: project.archived,
            }}
          />
          <Link href={runHref} className={buttonClasses("primary", "sm")}>
            ▶ Run with Curly
          </Link>
        </div>
      </div>

      {/* Tasks */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Tasks</h2>
        <Card padding="loose">
          {project.dir ? (
            <TaskList slug={project.slug} initial={tasks} />
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">No project folder yet — scaffold one to track tasks &amp; notes.</p>
              <ScaffoldButton slug={project.slug} name={project.name} />
            </div>
          )}
        </Card>
      </section>

      {/* Capture to project journal */}
      {project.dir && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Add to project journal</h2>
          <Card padding="loose">
            <ProjectCapture slug={project.slug} />
          </Card>
        </section>
      )}

      {/* Related from your mind */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">From your mind</h2>
        {related.length === 0 ? (
          <p className="px-1 text-sm text-muted">Nothing related found yet.</p>
        ) : (
          <div className="space-y-2">
            {related.map((r) => (
              <Card key={r.rel} as={Link} href={noteHref(r.rel)} interactive>
                <div className="truncate text-sm font-medium text-foreground">
                  {r.rel.split("/").pop()?.replace(/\.md$/, "").replace(/[-_]/g, " ")}
                </div>
                {r.snippet && <p className="mt-1 line-clamp-2 text-xs text-subtle">{r.snippet}</p>}
                <div className="mt-1 truncate text-[11px] text-muted">{r.rel}</div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
