import Link from "next/link";
import { dirCounts } from "@/lib/graph";
import { KNOWN_DIRS, HIDDEN_DIRS } from "@/lib/vault-fs";
import { noteHref } from "@/lib/vault-paths";
import { prettyDir } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { PageHeading } from "@/components/ui/PageHeading";

export const dynamic = "force-dynamic";

// Top-level folder grid for the whole vault (systems/archives hidden). Counts
// come straight off graph.sqlite (one query, recursive).
export default function NotesIndex() {
  const counts = dirCounts();
  const dirs = (KNOWN_DIRS as readonly string[])
    .filter((d) => !HIDDEN_DIRS.has(d) && (counts[d] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Notes"
        subtitle="Browse every folder in your mind."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {dirs.map((d) => (
          <Card key={d} as={Link} href={noteHref(d)} interactive padding="loose">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium text-foreground">{prettyDir(d)}</span>
              <span className="shrink-0 text-xs text-muted">{counts[d]}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
