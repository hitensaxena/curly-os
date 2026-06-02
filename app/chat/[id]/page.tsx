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
    <div className="flex h-full flex-1 flex-col">
      <header className="shrink-0 border-b border-border/40 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground">Chat with Curly</h1>
            <p className="truncate text-xs text-muted">
              {user.displayName ?? user.username}
              <span className="ml-2 font-mono opacity-50">{id.slice(0, 8)}</span>
            </p>
          </div>
        </div>
      </header>
      <ChatWindow
        sessionId={id}
        initialMessages={initialMessages}
        chatExists={!!existing}
      />
    </div>
  );
}
