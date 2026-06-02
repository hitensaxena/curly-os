import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAllowed, usernameFromHeaders } from "@/lib/auth";

// Defense-in-depth: Caddy + Authentik enforce auth at the proxy layer.
//   1. No X-authentik-username header → 401. Authentik will catch this and
//      redirect to its login flow; if a request reaches here without it,
//      something is misconfigured upstream.
//   2. Authenticated but not the allow-listed user → /api/* gets a JSON 403;
//      everything else is rewritten to /forbidden so the user sees the
//      cool not-allowed page no matter which URL they tried.
export function proxy(request: NextRequest) {
  const username = usernameFromHeaders(request.headers);
  if (!username) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (isAllowed(request.headers)) {
    return NextResponse.next();
  }
  // The /forbidden page itself must always render for the not-allowed user.
  // Proxy runs for EVERY route (incl. rewrite destinations), so rewriting
  // /forbidden onto itself re-invokes this proxy and loops forever — the
  // request hangs with no response. Short-circuit here so the denial page
  // renders. (Docs: node_modules/next/dist/docs/.../file-conventions/proxy.md
  // "Proxy will be invoked for every route in your project".)
  const { pathname } = request.nextUrl;
  if (pathname === "/forbidden") {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = "/forbidden";
  url.search = "";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
