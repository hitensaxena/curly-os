import { appendToJournal, captureNote } from "@/lib/vault-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Capture from the screen. mode:"journal" appends a timestamped block to today's
// daily journal; mode:"note" creates/append a note in a chosen vault dir. Both
// commit to the vault git + reindex + ingest into the brain (see lib/vault-fs).
type Body = {
  mode?: "journal" | "note";
  content?: unknown;
  section?: unknown;
  title?: unknown;
  directory?: unknown;
  tags?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return Response.json({ ok: false, reason: "content required" }, { status: 400 });
  }
  if (content.length > 100_000) {
    return Response.json({ ok: false, reason: "content too large" }, { status: 413 });
  }

  try {
    const result =
      body.mode === "note"
        ? await captureNote({
            content,
            title: typeof body.title === "string" ? body.title : undefined,
            directory: typeof body.directory === "string" ? body.directory : undefined,
            tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
          })
        : await appendToJournal({
            content,
            section: typeof body.section === "string" ? body.section : undefined,
          });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    return Response.json(
      { ok: false, reason: e instanceof Error ? e.message : "capture failed" },
      { status: 500 },
    );
  }
}
