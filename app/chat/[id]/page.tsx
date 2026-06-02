import { getCurrentUser } from "@/lib/auth";
import { getChat } from "@/lib/chats-db";
import { ChatWindow } from "../ChatWindow";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export default async function ChatByIdPage({ params }: Ctx) {
  const { id } = await params;
  const user = await getCurrentUser();
  const existing = getChat(id);
  const initialMessages = existing
    ? existing.messages.map((m) => ({ role: m.role, content: m.content }))
    : [];

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <a href="/" className="text-sm font-semibold text-foreground hover:text-accent">
            Curly OS
          </a>
          <p className="text-xs text-muted">
            Chat with Curly · {user.displayName ?? user.username}
            <span className="ml-2 font-mono opacity-60">{id.slice(0, 8)}</span>
          </p>
        </div>
      </header>
      <ChatWindow
        sessionId={id}
        initialMessages={initialMessages}
        chatExists={!!existing}
      />
    </main>
  );
}
