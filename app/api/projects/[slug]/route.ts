import { getProject, updateProject, type ProjectPatch } from "@/lib/projects";
import { isProjectType } from "@/lib/project-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return Response.json({ ok: false, reason: "not found" }, { status: 404 });
  return Response.json({ ok: true, project });
}

// PATCH { name?, summary?, status?, type?, code?, emoji?, color?, links?, archived? }
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: ProjectPatch = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.summary === "string") patch.summary = body.summary;
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.type === "string" && isProjectType(body.type)) patch.type = body.type;
  if (typeof body.code === "string") patch.code = body.code;
  if (body.emoji === null || typeof body.emoji === "string") patch.emoji = body.emoji as string | null;
  if (body.color === null || typeof body.color === "string") patch.color = body.color as string | null;
  if (typeof body.archived === "boolean") patch.archived = body.archived;
  if (Array.isArray(body.links)) {
    patch.links = body.links
      .filter((l): l is { label?: unknown; url?: unknown } => !!l && typeof l === "object")
      .map((l) => ({
        label: typeof l.label === "string" ? l.label : "",
        url: typeof l.url === "string" ? l.url : "",
      }))
      .filter((l) => l.url);
  }

  const result = await updateProject(slug, patch);
  return Response.json(result, { status: result.ok ? 200 : result.reason === "not found" ? 404 : 400 });
}
