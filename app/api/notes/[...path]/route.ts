import { readVaultNote, saveVaultNote } from "@/lib/vault-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function relFrom(parts: string[]): string {
  return parts.map(decodeURIComponent).join("/");
}

// GET /api/notes/<...path> — read a single note (raw + parsed). Used by the
// editor to load markdown.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  try {
    const note = await readVaultNote(relFrom(path));
    if (!note) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(note);
  } catch {
    return Response.json({ error: "bad path" }, { status: 400 });
  }
}

// PUT /api/notes/<...path> — save edited markdown. Sandboxed + committed +
// reindexed + ingested in lib/vault-fs. Optional expectedMtime guards against
// clobbering a concurrent (e.g. voice) edit → 409.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const rel = relFrom(path);
  const body = (await request.json().catch(() => ({}))) as {
    content?: unknown;
    expectedMtime?: unknown;
  };
  if (typeof body.content !== "string") {
    return Response.json({ ok: false, reason: "content required" }, { status: 400 });
  }
  if (body.content.length > 1_000_000) {
    return Response.json({ ok: false, reason: "content too large" }, { status: 413 });
  }
  try {
    const result = await saveVaultNote(
      rel,
      body.content,
      typeof body.expectedMtime === "number" ? body.expectedMtime : undefined,
    );
    const status = result.ok ? 200 : result.reason === "conflict" ? 409 : 400;
    return Response.json(result, { status });
  } catch (e) {
    return Response.json(
      { ok: false, reason: e instanceof Error ? e.message : "save failed" },
      { status: 500 },
    );
  }
}
