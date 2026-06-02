import { getProject } from "@/lib/projects";
import { readVaultNote, saveVaultNote } from "@/lib/vault-fs";
import { parseTasks, toggleTask, addTask } from "@/lib/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { action:'toggle', line, done } | { action:'add', text }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project?.dir) {
    return Response.json({ ok: false, reason: "no project folder" }, { status: 400 });
  }
  const rel = `${project.dir}/tasks.md`;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    line?: unknown;
    done?: unknown;
    text?: unknown;
  };

  const note = await readVaultNote(rel);
  const current = note?.raw ?? "# Tasks\n";
  let next: string;
  if (body.action === "toggle" && typeof body.line === "number") {
    next = toggleTask(current, body.line, !!body.done);
  } else if (body.action === "add" && typeof body.text === "string" && body.text.trim()) {
    next = addTask(current, body.text);
  } else {
    return Response.json({ ok: false, reason: "bad action" }, { status: 400 });
  }

  const res = await saveVaultNote(rel, next, note?.mtime);
  if (!res.ok) {
    return Response.json(res, { status: res.reason === "conflict" ? 409 : 400 });
  }
  const after = await readVaultNote(rel);
  return Response.json({ ok: true, tasks: parseTasks(after?.raw ?? next) });
}
