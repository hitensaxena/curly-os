// Dedicated SSE passthrough — the catch-all proxy buffers full responses before
// returning, so it cannot forward a text/event-stream. This route pipes the
// upstream SSE directly to the browser with no buffering.
import { NextRequest } from "next/server";
import { CORE_URL } from "@/lib/core";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const types = searchParams.get("types") ?? "";

  const upstreamUrl = `${CORE_URL}/api/events/stream${types ? `?types=${encodeURIComponent(types)}` : ""}`;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      headers: { Accept: "text/event-stream", "Cache-Control": "no-cache" },
      // @ts-expect-error — node-fetch / undici duplex option
      duplex: "half",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`data: {"error":"${msg}"}\n\n`, {
      status: 502,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    return new Response(`data: {"error":"upstream ${upstreamRes.status}"}\n\n`, {
      status: upstreamRes.status,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  // Pipe the upstream body directly — zero buffering.
  return new Response(upstreamRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
