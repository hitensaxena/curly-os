// Maps a voice `navigate` target to a real OS route (preferred) or a graph
// intent. Now that the domain workspaces exist, domain words and vault paths
// drive actual navigation; only graph-ish targets fall back to the panel graph.

export const ROUTE_TARGETS: Record<string, string> = {
  home: "/",
  dashboard: "/",
  search: "/search",
  chat: "/chat",
  surface: "/surface",
};

export type Resolved =
  | { mode: "route"; href: string }
  | { mode: "graph"; nodeId: string | null }
  | { mode: "none"; query: string };

export function resolveTarget(target: string): Resolved {
  const key = target.trim().toLowerCase();
  if (ROUTE_TARGETS[key]) return { mode: "route", href: ROUTE_TARGETS[key]! };
  // A note path used to route to /notes, which no longer exists — the link
  // 404'd from the orb, the voice panel and chat. Such targets now fall
  // through to "none" so the caller says it could not find them.
  if (target.endsWith(".md") || target.includes("/")) {
    return { mode: "none", query: target };
  }
  // ONLY explicit graph-ish words open the mind graph.
  if (/\bgraph|mind ?map|network|connections?\b/.test(key)) return { mode: "graph", nodeId: null };
  // otherwise: don't silently open the graph — let the caller say "couldn't find it".
  return { mode: "none", query: target };
}
