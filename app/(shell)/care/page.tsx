import Link from "next/link";
import { readVaultNote } from "@/lib/vault-fs";
import { noteHref } from "@/lib/vault-paths";
import { Card } from "@/components/ui/Card";
import { Markdown } from "@/components/Markdown";
import { CareCheckin } from "@/components/care/CareCheckin";
import { PageHeading } from "@/components/ui/PageHeading";

export const dynamic = "force-dynamic";

// Self-care: your own routine + health notes, and a gentle check-in. Read-only
// for health (sensitive); the check-in writes to the daily journal, not health/.
export default async function CarePage() {
  const [routine, health] = await Promise.all([
    readVaultNote("ai-context/routines.md").catch(() => null),
    readVaultNote("health/conditions.md").catch(() => null),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
      <PageHeading
        title="Self-care"
        subtitle="A quiet check on how you're doing — no pressure, just noticing."
        tone="warm"
      />

      {/* Check-in */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">How are you right now?</h2>
        <Card padding="loose">
          <CareCheckin />
        </Card>
      </section>

      {/* Your rhythm */}
      {routine && (
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Your rhythm</h2>
            <Link href={noteHref(routine.rel)} className="text-xs text-accent-2 hover:underline">
              open →
            </Link>
          </div>
          <Card padding="loose">
            <div className="max-h-80 overflow-y-auto">
              <Markdown>{routine.body}</Markdown>
            </div>
          </Card>
        </section>
      )}

      {/* Health context (read-only) */}
      {health && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Health context</h2>
            <Link href={noteHref(health.rel)} className="text-xs text-muted hover:text-foreground">
              full notes →
            </Link>
          </div>
          <Card padding="loose">
            <div className="max-h-64 overflow-y-auto">
              <Markdown>{health.body}</Markdown>
            </div>
            <p className="mt-3 text-[11px] text-muted">Read-only — your notes, kept as-is.</p>
          </Card>
        </section>
      )}
    </div>
  );
}
