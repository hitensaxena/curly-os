import type { ChatRow, MessageRow } from "@/lib/chats-db";

export function slugifyChatTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "chat";
}

export function chatExportFilename(chat: ChatRow): string {
  const date = new Date(chat.started_at).toISOString().slice(0, 10);
  return `chat-${date}-${slugifyChatTitle(chat.first_q)}.md`;
}

export function renderChatAsMarkdown(opts: {
  chat: ChatRow;
  messages: MessageRow[];
  summary: string | null;
}): string {
  const { chat, messages, summary } = opts;
  const date = new Date(chat.started_at).toISOString().slice(0, 10);

  const lines: Array<string | null> = [
    `# ${chat.first_q.slice(0, 120)}`,
    "",
    `_Promoted from chat ${chat.id} on ${date}._`,
    "",
    summary ? `**Summary:** ${summary}` : null,
    summary ? "" : null,
    "---",
    "",
    ...messages.map((m) => {
      const speaker = m.role === "user" ? "**You**" : "**Claude**";
      return `${speaker}:\n\n${m.content}\n`;
    }),
  ];
  return lines.filter((x) => x !== null).join("\n");
}
