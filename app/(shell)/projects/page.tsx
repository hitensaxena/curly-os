import { listProjects, registryExists } from "@/lib/projects";
import { NewProjectButton } from "@/components/projects/NewProjectButton";
import { ProjectsGrid } from "@/components/projects/ProjectsGrid";
import { PageHeading } from "@/components/ui/PageHeading";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, hasRegistry] = await Promise.all([listProjects(), registryExists()]);
  const cards = projects.map((p) => ({
    slug: p.slug,
    name: p.name,
    status: p.status,
    dir: p.dir,
    summary: p.summary,
    type: p.type,
    emoji: p.emoji,
    archived: p.archived,
  }));

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Projects"
        subtitle="Work on what matters, with your brain behind you."
        actions={<NewProjectButton hasRegistry={hasRegistry} />}
      />
      <ProjectsGrid projects={cards} />
    </div>
  );
}
