"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isSettingsReadable } from "@/lib/vault-paths";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { GroundedOn, type RetrievalChunk } from "@/components/chat/GroundedOn";

export type { RetrievalChunk };

export type Phase = "retrieving" | "thinking" | "working" | "writing" | "done";

type Props = {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: string;
  retrieval?: RetrievalChunk[];
  phase?: Phase;
};

// Phase → loader copy + bloom-mark animation state. The conversational chat
// route emits only "retrieving" then "writing", so those are the cases that
// matter; anything else falls back to the recall label.
function phaseDisplay(phase: Phase | undefined): {
  label: string;
  state: "loading" | "thinking" | "drafting";
} {
  switch (phase) {
    case "writing":
      return { label: "Writing…", state: "drafting" };
    case "retrieving":
    default:
      return { label: "Recalling…", state: "loading" };
  }
}

// Heuristic: when Curly writes `personal_lore.md` (an inline code span ending
// in .md), we treat it as a citation and link to the note in the OS notes
// browser, which can open any readable vault file.
function FilenameCode({ name }: { name: string }) {
  return (
    <Link
      href={`/notes/${name}`}
      className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground underline decoration-dotted underline-offset-2 hover:bg-surface-3"
    >
      {name}
    </Link>
  );
}

export function ChatMessage({ role, content, streaming, error, retrieval, phase }: Props) {
  const isUser = role === "user";
  const waiting = !!streaming && !content;
  return (
    <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      {!isUser && retrieval && retrieval.length > 0 && <GroundedOn chunks={retrieval} />}
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
          isUser ? "bg-accent text-accent-fg" : "bg-surface text-foreground"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{content}</div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-surface-2 prose-pre:text-foreground">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code(props) {
                  const { className, children, ...rest } = props;
                  const text = String(children ?? "");
                  // Block code (has language-* class) → leave as <code> for prose styling.
                  if (className) return <code className={className} {...rest}>{children}</code>;
                  // Inline citation: a bare filename ending in .md, only
                  // rendered as a link when it's a readable vault file the
                  // notes browser can open.
                  if (
                    /^[\w./-]+\.md$/.test(text) &&
                    !text.startsWith("/") &&
                    isSettingsReadable(text)
                  ) {
                    return <FilenameCode name={text} />;
                  }
                  return <code {...rest}>{children}</code>;
                },
              }}
            >
              {content}
            </ReactMarkdown>
            {waiting && (() => {
              const { label, state } = phaseDisplay(phase);
              return (
                <div className="flex items-center gap-2 py-1 text-xs text-muted">
                  <AnimatedLogo state={state} size="sm" />
                  <span>{label}</span>
                </div>
              );
            })()}
            {error && <p className="mt-2 text-xs text-danger">⚠ {error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
