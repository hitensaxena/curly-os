import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { brain } from "@/lib/brain";
import { fileCount, linkCount } from "@/lib/graph";
import { recentNotes, todayJournal, lastJournal } from "@/lib/vault-fs";
import { listChats } from "@/lib/chats-db";
import { listProjects } from "@/lib/projects";
import { noteHref } from "@/lib/vault-paths";
import { Card } from "@/components/ui/Card";
import { QuickCapture } from "@/components/dashboard/QuickCapture";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late night";
}

function relTime(ms: number): string {
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

const QUICK_LINKS = [
  { href: "/projects", label: "Projects", hint: "work on what matters" },
  { href: "/journal", label: "Journal", hint: "today & the trail behind" },
  { href: "/care", label: "Self-care", hint: "check in with yourself" },
  { href: "/agent", label: "Agent", hint: "give Curly a task" },
];

export default async function Home() {
  const [user, stats, recent, today, last, projects] = await Promise.all([
    getCurrentUser().catch(() => null),
    brain.stats().catch(() => null),
    recentNotes(8).catch(() => []),
    todayJournal().catch(() => null),
    lastJournal().catch(() => null),
    listProjects().catch(() => []),
  ]);
  const topProjects = projects.filter((p) => p.status === "active").slice(0, 4);
  const vault = { files: fileCount(), links: linkCount() };
  let chats: ReturnType<typeof listChats> = [];
  try {
    chats = listChats().slice(0, 5);
  } catch {
    /* no chats yet */
  }

  const name = user?.displayName || user?.username || "there";
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground text-glow">
            {greeting()}, {name}.
          </h1>
          <p className="mt-1 text-sm text-muted">{dateLabel}</p>
        </div>
        <div className="flex gap-2 text-xs text-muted">
          <span className="rounded-md border border-border bg-surface px-3 py-1.5">
            {vault.files.toLocaleString()} notes · {vault.links.toLocaleString()} links
          </span>
          <span className="rounded-md border border-border bg-surface px-3 py-1.5">
            brain{" "}
            {stats
              ? `${stats.nodes.toLocaleString()} · ${stats.chunks.toLocaleString()} chunks`
              : "offline"}
          </span>
        </div>
      </div>

      {/* Quick links */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_LINKS.map((l) => (
          <Card key={l.href} as={Link} href={l.href} interactive padding="loose">
            <div className="font-medium text-foreground">{l.label}</div>
            <div className="mt-1 text-xs text-muted">{l.hint}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <QuickCapture />

          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">Recent notes</h2>
            {recent.length === 0 ? (
              <Card>
                <p className="text-sm text-muted">No notes yet.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {recent.map((n) => (
                  <Card key={n.rel} as={Link} href={noteHref(n.rel)} interactive>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium text-foreground">{n.title}</span>
                      <span className="shrink-0 text-xs text-muted">{relTime(n.mtime)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">{n.rel}</div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Aside */}
        <div className="space-y-6">
          {topProjects.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-foreground">Projects</h2>
                <Link href="/projects" className="text-xs text-muted hover:text-foreground">
                  all →
                </Link>
              </div>
              <div className="space-y-2">
                {topProjects.map((p) => (
                  <Card key={p.slug} as={Link} href={`/projects/${p.slug}`} interactive>
                    <div className="truncate text-sm font-medium text-foreground">{p.name}</div>
                    {p.summary && (
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted">{p.summary}</div>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">Journal</h2>
            {today ? (
              <Card as={Link} href={noteHref(today.rel)} interactive>
                <div className="text-xs font-medium uppercase tracking-wide text-accent-2">
                  Today
                </div>
                <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-subtle">
                  {today.body || "Started — nothing written yet."}
                </p>
              </Card>
            ) : last ? (
              <Card as={Link} href={noteHref(last.rel)} interactive>
                <div className="text-xs font-medium uppercase tracking-wide text-muted">
                  Last entry · {relTime(last.mtime)}
                </div>
                <p className="mt-1 truncate text-sm text-subtle">{last.title}</p>
                <p className="mt-1 text-xs text-muted">
                  Nothing today yet — capture above to start.
                </p>
              </Card>
            ) : (
              <Card>
                <p className="text-sm text-muted">No journal entries yet.</p>
              </Card>
            )}
          </section>

          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">Jump back in</h2>
            {chats.length === 0 ? (
              <Card>
                <p className="text-sm text-muted">No conversations yet.</p>
                <Link href="/chat" className="mt-2 inline-block text-xs text-accent hover:underline">
                  Start a chat →
                </Link>
              </Card>
            ) : (
              <div className="space-y-2">
                {chats.map((c) => (
                  <Card key={c.id} as={Link} href={`/chat/${c.id}`} interactive>
                    <div className="truncate text-sm text-foreground">
                      {c.summary || c.first_q}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {c.message_count} msg · {relTime(c.started_at)}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
