import Link from "next/link";
import { todayJournal, listVaultDir, type VaultListing } from "@/lib/vault-fs";
import { noteHref } from "@/lib/vault-paths";
import { relTime, prettyDir } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { QuickCapture } from "@/components/dashboard/QuickCapture";
import { Markdown } from "@/components/Markdown";
import { PageHeading } from "@/components/ui/PageHeading";

export const dynamic = "force-dynamic";

const EMPTY: VaultListing = { rel: "", dirs: [], files: [] };

export default async function JournalPage() {
  const [today, daily, root, reflections] = await Promise.all([
    todayJournal().catch(() => null),
    listVaultDir("journals/daily").catch(() => EMPTY),
    listVaultDir("journals").catch(() => EMPTY),
    listVaultDir("journals/reflections").catch(() => EMPTY),
  ]);
  const moreDirs = root.dirs.filter(
    (d) => d.rel !== "journals/daily" && d.rel !== "journals/reflections",
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Journal"
        subtitle="Today, and the trail behind you."
        tone="warm"
      />

      {/* Today */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Today</h2>
          {today && (
            <Link href={noteHref(today.rel)} className="text-xs text-accent-2 hover:underline">
              open →
            </Link>
          )}
        </div>
        <QuickCapture />
        {today?.body && (
          <Card className="mt-3" padding="loose">
            <div className="max-h-56 overflow-hidden">
              <Markdown>{today.body}</Markdown>
            </div>
          </Card>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Daily timeline */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Daily entries</h2>
          {daily.files.length === 0 ? (
            <p className="px-1 text-sm text-muted">No entries yet.</p>
          ) : (
            <div className="space-y-2">
              {daily.files.map((f) => (
                <Card key={f.rel} as={Link} href={noteHref(f.rel)} interactive>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium text-foreground">{f.title}</span>
                    <span className="shrink-0 text-xs text-muted">{relTime(f.mtime)}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Reflections */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Reflections</h2>
          {reflections.files.length === 0 ? (
            <p className="px-1 text-sm text-muted">None yet.</p>
          ) : (
            <div className="space-y-2">
              {reflections.files
                .filter((f) => f.name !== "_index.md")
                .map((f) => (
                  <Card key={f.rel} as={Link} href={noteHref(f.rel)} interactive>
                    <div className="truncate font-medium text-foreground">{f.title}</div>
                  </Card>
                ))}
            </div>
          )}
        </section>
      </div>

      {/* Other journal sections */}
      {moreDirs.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-foreground">More</h2>
          <div className="flex flex-wrap gap-2">
            {moreDirs.map((d) => (
              <Link
                key={d.rel}
                href={noteHref(d.rel)}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-subtle hover:bg-surface-2"
              >
                {prettyDir(d.name)} · {d.count}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
