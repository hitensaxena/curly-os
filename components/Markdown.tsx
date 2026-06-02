"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { noteHref } from "@/lib/vault-paths";

// Shared prose renderer (GFM). A bare inline `filename.md` becomes a link into
// the notes reader — the same citation affordance the chat uses, pointed at the
// OS notes browser instead of /settings.
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:text-foreground prose-a:text-accent",
        "prose-pre:bg-surface-2 prose-pre:text-foreground",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { className: cls, children: kids, ...rest } = props;
            const text = String(kids ?? "");
            if (cls) {
              return (
                <code className={cls} {...rest}>
                  {kids}
                </code>
              );
            }
            if (/^[\w./-]+\.md$/.test(text) && !text.startsWith("/")) {
              return (
                <Link
                  href={noteHref(text)}
                  className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground underline decoration-dotted underline-offset-2 hover:bg-surface-3"
                >
                  {text}
                </Link>
              );
            }
            return <code {...rest}>{kids}</code>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
