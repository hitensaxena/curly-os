// Maps a voice `navigate` target to a real OS route (preferred) or a graph
// intent. Now that the domain workspaces exist, domain words and vault paths
// drive actual navigation; only graph-ish targets fall back to the panel graph.
import { noteHref } from "@/lib/vault-paths";

export const ROUTE_TARGETS: Record<string, string> = {
  home: "/",
  dashboard: "/",
  projects: "/projects",
  project: "/projects",
  journal: "/journal",
  journals: "/journal",
  diary: "/journal",
  care: "/care",
  "self care": "/care",
  "self-care": "/care",
  health: "/care",
  wellbeing: "/care",
  search: "/search",
  notes: "/notes",
  agent: "/agent",
  chat: "/chat",
  surface: "/surface",
};

export type Resolved = { mode: "route"; href: string } | { mode: "graph"; nodeId: string | null };

export function resolveTarget(target: string): Resolved {
  const key = target.trim().toLowerCase();
  if (ROUTE_TARGETS[key]) return { mode: "route", href: ROUTE_TARGETS[key]! };
  // a specific note -> the notes reader
  if (target.endsWith(".md")) return { mode: "route", href: noteHref(target) };
  // a vault directory path -> the notes browser
  if (target.includes("/")) return { mode: "route", href: noteHref(target.replace(/\/+$/, "")) };
  // graph-ish words -> the panel graph
  if (/\bgraph|mind ?map|network|connections?\b/.test(key)) return { mode: "graph", nodeId: null };
  return { mode: "graph", nodeId: null };
}
