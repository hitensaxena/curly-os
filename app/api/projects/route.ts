import { listProjects, createProject, seedRegistry } from "@/lib/projects";
import { isProjectType } from "@/lib/project-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ projects: await listProjects() });
}

// POST { action:'create', name, slug?, type?, code?, summary?, emoji? } | { action:'seed' }
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    name?: unknown;
    slug?: unknown;
    type?: unknown;
    code?: unknown;
    summary?: unknown;
    emoji?: unknown;
  };
  if (body.action === "seed") {
    return Response.json(await seedRegistry());
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return Response.json({ ok: false, reason: "name required" }, { status: 400 });
  }
  const result = await createProject(name, {
    slug: typeof body.slug === "string" ? body.slug : undefined,
    type: typeof body.type === "string" && isProjectType(body.type) ? body.type : undefined,
    code: typeof body.code === "string" ? body.code : undefined,
    summary: typeof body.summary === "string" ? body.summary : undefined,
    emoji: typeof body.emoji === "string" ? body.emoji : undefined,
  });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
