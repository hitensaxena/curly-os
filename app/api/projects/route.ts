import { listProjects, createProject, seedRegistry } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ projects: await listProjects() });
}

// POST { action:'create', name, slug? } | { action:'seed' }
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    name?: unknown;
    slug?: unknown;
  };
  if (body.action === "seed") {
    return Response.json(await seedRegistry());
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return Response.json({ ok: false, reason: "name required" }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug : undefined;
  const result = await createProject(name, { slug });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
