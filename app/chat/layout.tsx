import { ShellFrame } from "@/components/shell/ShellFrame";
import { ChatHistory } from "@/components/chat/ChatHistory";

// Chat is a mode, not a surface: the rail stays, and the conversation list sits
// beside it so past chats are reachable.
export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ShellFrame fullHeight>
      <div className="flex h-full min-h-0 w-full">
        <ChatHistory />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </ShellFrame>
  );
}
