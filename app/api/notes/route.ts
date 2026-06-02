import { listVaultDir } from "@/lib/vault-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/notes?dir=<rel> — list a vault directory (subdirs + notes). Default
// (no dir) lists the top-level content folders. Used for client-side refresh;
// the /notes pages render server-side via listVaultDir directly.
export async function GET(request: Request) {
  const dir = new URL(request.url).searchParams.get("dir") ?? "";
  try {
    return Response.json(await listVaultDir(dir));
  } catch {
    return Response.json({ error: "not found" }, { status: 404 });
  }
}
