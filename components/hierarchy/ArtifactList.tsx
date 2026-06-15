"use client";

import type { Artifact } from "@/lib/curlyos-types";

const KIND_META: Record<string, { icon: string; cls: string }> = {
  file: { icon: "📄", cls: "text-foreground border-border bg-surface-2" },
  doc: { icon: "📝", cls: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  pdf: { icon: "📕", cls: "text-red-400 border-red-400/30 bg-red-400/10" },
  image: { icon: "🖼", cls: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
  code: { icon: "⌨", cls: "text-green-400 border-green-400/30 bg-green-400/10" },
  deploy: { icon: "🚀", cls: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10" },
  link: { icon: "🔗", cls: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10" },
  data: { icon: "▦", cls: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
};

function fmtBytes(n: number | null): string {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function StatusDot({ status }: { status: string }) {
  const cls =
    status === "published"
      ? "bg-green-400"
      : status === "updated"
      ? "bg-accent"
      : status === "archived"
      ? "bg-muted"
      : "bg-sky-400";
  return <span className={`h-1.5 w-1.5 rounded-full ${cls}`} title={status} />;
}

/** The studio surface — every tangible deliverable produced toward a goal/project. */
export function ArtifactList({
  artifacts,
  emptyHint,
}: {
  artifacts: Artifact[];
  emptyHint?: string;
}) {
  if (artifacts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
        {emptyHint ?? "No deliverables yet. When an agent writes a file or makes something, it shows up here."}
      </div>
    );
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {artifacts.map((a) => {
        const m = KIND_META[a.kind] ?? KIND_META.file;
        const body = (
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded border text-sm ${m.cls}`}>
              {m.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                <StatusDot status={a.status} />
              </div>
              {a.summary && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{a.summary}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted">
                <span className="rounded border border-border bg-surface-2 px-1 py-0.5">{a.kind}</span>
                {a.bytes ? <span>{fmtBytes(a.bytes)}</span> : null}
                {a.path && <span className="truncate" title={a.path}>{a.path.split("/").slice(-2).join("/")}</span>}
                {a.created_at && <span>{new Date(a.created_at).toLocaleDateString()}</span>}
              </div>
            </div>
          </div>
        );
        return (
          <div key={a.id} className="rounded-lg border border-border bg-surface p-3">
            {a.url ? (
              <a href={a.url} target="_blank" rel="noreferrer" className="block hover:opacity-80">
                {body}
              </a>
            ) : (
              body
            )}
          </div>
        );
      })}
    </div>
  );
}
