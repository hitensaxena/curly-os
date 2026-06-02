import { getBriefing } from "@/lib/briefing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The proactive briefing as JSON — used by the (future) command-bar compact
// briefing and any client-side refresh. Page loads use getBriefing() directly.
export async function GET() {
  return Response.json(await getBriefing());
}
