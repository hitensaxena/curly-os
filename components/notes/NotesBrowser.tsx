import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { noteHref } from "@/lib/vault-paths";
import { relTime } from "@/lib/format";
import type { VaultListing } from "@/lib/vault-fs";

// Folder + note listing for a single vault directory. Server component — pure
// links, no client state.
export function NotesBrowser({ listing }: { listing: VaultListing }) {
  const segments = listing.rel ? listing.rel.split("/") : [];

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <Breadcrumb segments={segments} />

      {listing.dirs.length > 0 && (
        <section className="mb-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {listing.dirs.map((d) => (
              <Card key={d.rel} as={Link} href={noteHref(d.rel)} interactive padding="loose">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-foreground">{d.name}</span>
                  <span className="shrink-0 text-xs text-muted">{d.count}</span>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {listing.files.length > 0 ? (
        <div className="space-y-2">
          {listing.files.map((f) => (
            <Card key={f.rel} as={Link} href={noteHref(f.rel)} interactive>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-medium text-foreground">{f.title}</span>
                <span className="shrink-0 text-xs text-muted">{relTime(f.mtime)}</span>
              </div>
              <div className="mt-0.5 truncate text-xs text-muted">{f.name}</div>
            </Card>
          ))}
        </div>
      ) : listing.dirs.length === 0 ? (
        <p className="px-1 text-sm text-muted">This folder is empty.</p>
      ) : null}
    </div>
  );
}

function Breadcrumb({ segments }: { segments: string[] }) {
  return (
    <nav className="mb-5 flex flex-wrap items-center gap-1 text-sm text-muted">
      <Link href="/notes" className="hover:text-foreground">
        Notes
      </Link>
      {segments.map((seg, i) => {
        const rel = segments.slice(0, i + 1).join("/");
        const last = i === segments.length - 1;
        return (
          <span key={rel} className="flex items-center gap-1">
            <span aria-hidden>/</span>
            {last ? (
              <span className="text-foreground">{seg}</span>
            ) : (
              <Link href={noteHref(rel)} className="hover:text-foreground">
                {seg}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
