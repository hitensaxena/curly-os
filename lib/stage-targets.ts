// Maps a voice `navigate` target to either a real route push or (5c) a graph
// card. Degrades gracefully today: only /, /chat, /surface routes exist, so
// anything path-like or unknown becomes a graph intent (full-vault fallback),
// which 5a renders as a lightweight "opening" card until the graph lands.
export const ROUTE_TARGETS: Record<string, string> = {
  home: '/',
  chat: '/chat',
  surface: '/surface',
};

export type Resolved = { mode: 'route'; href: string } | { mode: 'graph'; nodeId: string | null };

export function resolveTarget(target: string): Resolved {
  const key = target.trim().toLowerCase();
  if (ROUTE_TARGETS[key]) return { mode: 'route', href: ROUTE_TARGETS[key]! };
  if (target.includes('/') || target.endsWith('.md')) return { mode: 'graph', nodeId: target };
  return { mode: 'graph', nodeId: null };
}
