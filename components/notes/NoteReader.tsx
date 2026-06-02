import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { buttonClasses } from "@/components/ui/Button";
import { noteHref } from "@/lib/vault-paths";
import { relTime } from "@/lib/format";
import type { VaultNote } from "@/lib/vault-fs";
import type { Neighbor } from "@/lib/graph";

// Read view for a single note: title, frontmatter chips, rendered markdown,
// and wiki-link backlinks from graph.sqlite. Server component.
export function NoteReader({
  note,
  neighbors,
}: {
  note: VaultNote;
  neighbors: Neighbor[];
}) {
  const dir = note.rel.includes("/") ? note.rel.slice(0, note.rel.lastIndexOf("/")) : "";
  const tags = Array.isArray(note.frontmatter.tags)
    ? note.frontmatter.tags.map(String)
    : [];
  const date =
    typeof note.frontmatter.date === "string" ? note.frontmatter.date : null;

  const out = dedupe(neighbors.filter((n) => n.direction === "out"));
  const incoming = dedupe(neighbors.filter((n) => n.direction === "in"));

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted">
            <Link href="/notes" className="hover:text-foreground">
              Notes
            </Link>
            {dir && (
              <>
                <span aria-hidden>/</span>
                <Link href={noteHref(dir)} className="hover:text-foreground">
                  {dir}
                </Link>
              </>
            )}
          </nav>
          <h1 className="text-2xl font-semibold text-foreground">{note.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="font-mono">{note.rel}</span>
            <span>· edited {relTime(note.mtime)}</span>
            {date && <span>· {date}</span>}
          </div>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-subtle"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        {note.writeable && (
          <Link
            href={`${noteHref(note.rel)}?edit=1`}
            className={buttonClasses("secondary", "sm", "shrink-0")}
          >
            Edit
          </Link>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface px-5 py-4">
        {note.body.trim() ? (
          <Markdown>{note.body}</Markdown>
        ) : (
          <p className="text-sm text-muted">This note is empty.</p>
        )}
      </div>

      {(incoming.length > 0 || out.length > 0) && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Backlinks title="Linked from" items={incoming} />
          <Backlinks title="Links to" items={out} />
        </div>
      )}
    </article>
  );
}

function Backlinks({ title, items }: { title: string; items: Neighbor[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      <ul className="space-y-1">
        {items.map((n) => (
          <li key={`${n.direction}:${n.rel}`}>
            <Link
              href={noteHref(n.rel)}
              className="block truncate text-sm text-accent-2 hover:underline"
            >
              {n.linkText?.trim() || n.rel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function dedupe(items: Neighbor[]): Neighbor[] {
  const seen = new Set<string>();
  return items.filter((n) => (seen.has(n.rel) ? false : (seen.add(n.rel), true)));
}
