// Proactive briefing — what Curly surfaces without being asked. A single
// server-only aggregator over existing libs (journal, projects/tasks, chats,
// graph/brain health). Every source is failure-guarded so a down brain or
// missing chats-db degrades to an empty section rather than erroring the page.
import { todayJournal, lastJournal, readVaultNote } from "@/lib/vault-fs";
import { listChats } from "@/lib/chats-db";
import { listProjects } from "@/lib/projects";
import { parseTasks } from "@/lib/tasks";
import { fileCount, linkCount } from "@/lib/graph";
import { brain } from "@/lib/brain";

export type BriefingTask = { project: string; slug: string; text: string };
export type BriefingChat = { id: string; title: string; messageCount: number; startedAt: number };

export interface Briefing {
  generatedAt: number;
  journal: {
    startedToday: boolean;
    lastRel: string | null;
    lastTitle: string | null;
    lastMtime: number | null;
  };
  staleTasks: BriefingTask[];
  resumeChats: BriefingChat[];
  suggestions: string[];
  health: { files: number; links: number; brain: { nodes: number; chunks: number } | null };
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export async function getBriefing(): Promise<Briefing> {
  const [today, last, projects, stats] = await Promise.all([
    todayJournal().catch(() => null),
    lastJournal().catch(() => null),
    listProjects().catch(() => [] as Awaited<ReturnType<typeof listProjects>>),
    brain.stats().catch(() => null),
  ]);

  // Open tasks across active projects that have a folder + tasks.md.
  const staleTasks: BriefingTask[] = [];
  await Promise.all(
    projects
      .filter((p) => p.status === "active")
      .map(async (p) => {
        if (!p.dir) return;
        const note = await readVaultNote(`${p.dir}/tasks.md`).catch(() => null);
        if (!note) return;
        for (const t of parseTasks(note.body)) {
          if (!t.done) staleTasks.push({ project: p.name, slug: p.slug, text: t.text });
        }
      }),
  );

  const chats = safe(() => listChats(), [] as ReturnType<typeof listChats>);
  const resumeChats: BriefingChat[] = chats
    .filter((c) => c.message_count >= 2)
    .slice(0, 4)
    .map((c) => ({
      id: c.id,
      title: c.summary || c.first_q,
      messageCount: c.message_count,
      startedAt: c.started_at,
    }));

  const suggestions: string[] = [];
  if (!today) suggestions.push("Start today’s journal");
  if (staleTasks[0]) suggestions.push(`Pick up “${staleTasks[0].text}”`);
  if (resumeChats[0]) suggestions.push(`Resume “${resumeChats[0].title}”`);

  return {
    generatedAt: Date.now(),
    journal: {
      startedToday: !!today,
      lastRel: last?.rel ?? null,
      lastTitle: last?.title ?? null,
      lastMtime: last?.mtime ?? null,
    },
    staleTasks: staleTasks.slice(0, 6),
    resumeChats,
    suggestions,
    health: {
      files: safe(() => fileCount(), 0),
      links: safe(() => linkCount(), 0),
      brain: stats ? { nodes: stats.nodes, chunks: stats.chunks } : null,
    },
  };
}
