import Link from "next/link";
import { listChats } from "@/lib/chats-db";

// Chats were already stored, but nothing listed them: /chat minted a new id on
// every visit and the old conversations were unreachable from the UI.
export function ChatHistory({ activeId }: { activeId?: string }) {
  let chats: ReturnType<typeof listChats> = [];
  try {
    chats = listChats();
  } catch {
    return null;
  }
  if (chats.length === 0) return null;

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-background/60 md:flex">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-[10px] uppercase tracking-widest text-muted">Chats</span>
        <Link
          href="/chat"
          className="rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:border-accent hover:text-foreground"
        >
          new
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <ul className="space-y-0.5">
          {chats.map((chat) => {
            const active = chat.id === activeId;
            return (
              <li key={chat.id}>
                <Link
                  href={`/chat/${chat.id}`}
                  title={chat.first_q}
                  className={`block truncate rounded px-2 py-1.5 text-xs transition-colors ${
                    active
                      ? "bg-surface text-foreground"
                      : "text-muted hover:bg-surface/60 hover:text-foreground"
                  }`}
                >
                  {chat.first_q || "Untitled"}
                  <span className="ml-1 text-[10px] text-muted/60">
                    {chat.message_count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
