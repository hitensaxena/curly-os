// Client-safe formatting helpers (no node imports).

export function relTime(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Prettify a top-level vault dir name for display ("ai-context" → "AI context").
export function prettyDir(name: string): string {
  if (name === "ai-context") return "AI context";
  return name.charAt(0).toUpperCase() + name.slice(1);
}
