// Human-readable name for the current route — sent to Curly as screen context.
const TOP: Record<string, string> = {
  projects: "Projects",
  journal: "Journal",
  care: "Self-care",
  search: "Search",
  notes: "Notes",
  agent: "Agent",
  chat: "Chat",
  surface: "Voice surface",
};

export function routeTitle(pathname: string): string {
  if (!pathname || pathname === "/") return "Home dashboard";
  const seg = pathname.split("/").filter(Boolean);
  const head = seg[0];
  if (head === "notes" && seg.length > 1) {
    const last = decodeURIComponent(seg[seg.length - 1]);
    return `Note: ${last.replace(/\.md$/, "").replace(/[-_]/g, " ")}`;
  }
  if (head === "projects" && seg.length > 1) {
    return `Project: ${decodeURIComponent(seg[1]).replace(/[-_]/g, " ")}`;
  }
  if (head === "chat" && seg.length > 1) return "A conversation";
  return TOP[head] ?? head;
}
