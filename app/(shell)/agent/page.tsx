import { listChats } from "@/lib/chats-db";
import { AgentConsole, type HistoryItem } from "@/components/agent/AgentConsole";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const sp = await searchParams;
  let history: HistoryItem[] = [];
  try {
    history = listChats()
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        first_q: c.first_q,
        summary: c.summary,
        message_count: c.message_count,
        started_at: c.started_at,
      }));
  } catch {
    /* chats db not created yet */
  }
  return <AgentConsole history={history} initialTask={typeof sp?.task === "string" ? sp.task : ""} />;
}
