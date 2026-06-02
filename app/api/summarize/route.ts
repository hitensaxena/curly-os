import { summarizePendingChats } from "@/lib/summarize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual / on-demand chat summarization. The primary path is lazy (one chat per
// home load, fire-and-forget); this lets the owner force a larger batch. Goes
// through the normal auth gate (proxy.ts) like every other route.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { batch?: unknown };
  const batch = typeof body.batch === "number" ? Math.min(Math.max(body.batch, 1), 20) : 5;
  const result = await summarizePendingChats(batch);
  return Response.json(result);
}
