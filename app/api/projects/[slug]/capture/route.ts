import { getProject } from "@/lib/projects";
import { appendToNote } from "@/lib/vault-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { content } — append a dated block to the project's journal.md.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project?.dir) {
    return Response.json({ ok: false, reason: "no project folder" }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as { content?: unknown };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return Response.json({ ok: false, reason: "content required" }, { status: 400 });
  }
  const res = await appendToNote(`${project.dir}/journal.md`, content);
  return Response.json(res, { status: res.ok ? 200 : 400 });
}
