// Base URL for the CurlyOS core API (FastAPI, default 127.0.0.1:8643).
// The browser reaches the same API through the app/api/[...path] proxy; server
// code (e.g. the briefing aggregator) calls it directly via this URL. Override
// with CURLYOS_API_URL in the environment.
export const CORE_URL = (
  process.env.CURLYOS_API_URL ?? "http://127.0.0.1:8643"
).replace(/\/$/, "");

// Ingest raw text into curlyos-core: records an episode + a recallable memory
// and schedules background knowledge extraction (POST /api/ingest). SERVER-ONLY.
// Failure-safe — a down/slow core must never break the vault write, so callers
// can await this without risk. Returns the ingest result, or null on failure.
export async function ingestToCore(
  text: string,
  sourceRef: string,
): Promise<{ epi_id?: string; mem_id?: string } | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const r = await fetch(`${CORE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed, source_ref: sourceRef }),
    });
    if (!r.ok) return null;
    return (await r.json()) as { epi_id?: string; mem_id?: string };
  } catch {
    return null;
  }
}
