import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { Briefing as BriefingData } from "@/lib/briefing";

// The proactive briefing hero — what Curly thinks matters right now. Server
// component; data is computed by getBriefing() on the page. The accompanying
// BriefingNudge (client) raises a once-a-day toast from the same data.
export function Briefing({ data }: { data: BriefingData }) {
  const { journal, staleTasks, resumeChats, suggestions, health } = data;

  return (
    <Card padding="loose" className="mb-6" glow="accent-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Your briefing</h2>
        <span className="shrink-0 text-xs text-muted">
          {health.files.toLocaleString()} notes ·{" "}
          {health.brain ? `${health.brain.nodes.toLocaleString()} in brain` : "brain offline"}
        </span>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <span
              key={i}
              className="rounded-md border border-[color:var(--accent-soft)] bg-accent-soft px-2.5 py-1 text-xs text-subtle"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <section>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-accent-2">Journal</div>
          {journal.startedToday ? (
            <p className="text-sm text-subtle">Started today ✓</p>
          ) : (
            <p className="text-sm text-muted">
              Not started today.
              {journal.lastTitle ? ` Last: ${journal.lastTitle}.` : ""}
            </p>
          )}
          <Link href="/journal" className="mt-1 inline-block text-xs text-accent hover:underline">
            Open journal →
          </Link>
        </section>

        <section>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-accent-2">Open tasks</div>
          {staleTasks.length === 0 ? (
            <p className="text-sm text-muted">All clear.</p>
          ) : (
            <ul className="space-y-1">
              {staleTasks.slice(0, 4).map((t, i) => (
                <li key={i} className="truncate text-sm">
                  <Link href={`/projects/${t.slug}`} className="text-subtle hover:text-foreground">
                    {t.text}
                  </Link>
                  <span className="ml-1 text-xs text-muted">· {t.project}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-accent-2">Pick up</div>
          {resumeChats.length === 0 ? (
            <p className="text-sm text-muted">No conversations yet.</p>
          ) : (
            <ul className="space-y-1">
              {resumeChats.slice(0, 3).map((c) => (
                <li key={c.id} className="truncate text-sm">
                  <Link href={`/chat/${c.id}`} className="text-subtle hover:text-foreground">
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Card>
  );
}
