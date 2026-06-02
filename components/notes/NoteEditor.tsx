"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Markdown } from "@/components/Markdown";
import { Toast } from "@/components/ui/Toast";
import { noteHref } from "@/lib/vault-paths";
import type { VaultNote } from "@/lib/vault-fs";

// Edit a note's raw markdown with a live preview. Saves via PUT (sandboxed,
// committed, reindexed, ingested server-side). expectedMtime guards against
// clobbering a concurrent voice edit (→ 409).
export function NoteEditor({ note }: { note: VaultNote }) {
  const router = useRouter();
  const [content, setContent] = useState(note.raw);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "danger"; text: string } | null>(null);

  const dirty = content !== note.raw;
  const putUrl = "/api/notes/" + note.rel.split("/").map(encodeURIComponent).join("/");

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(putUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, expectedMtime: note.mtime }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setMsg({
          kind: "danger",
          text: "This note changed elsewhere (voice?). Reload before saving.",
        });
        return;
      }
      if (!res.ok || !data.ok) throw new Error(data.reason || "save failed");
      router.push(noteHref(note.rel));
      router.refresh();
    } catch (e) {
      setMsg({ kind: "danger", text: e instanceof Error ? e.message : "save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-1px)] w-full max-w-6xl flex-col px-5 py-5 sm:px-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-xs text-muted">{note.rel}</div>
          <div className="text-sm text-foreground">Editing</div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={noteHref(note.rel)} className="text-sm text-muted hover:text-foreground">
            Cancel
          </Link>
          <Button size="sm" onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      {msg && (
        <Toast variant={msg.kind} className="mb-3">
          {msg.text}
        </Toast>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void save();
            }
          }}
          spellCheck={false}
          className="h-full min-h-0 resize-none font-mono text-[13px] leading-relaxed"
        />
        <div className="min-h-0 overflow-y-auto rounded-md border border-border bg-surface px-5 py-4">
          <Markdown>{stripFrontmatter(content)}</Markdown>
        </div>
      </div>
    </div>
  );
}

// The textarea holds the raw file incl. frontmatter; the preview shouldn't show
// the --- block, so strip a leading fenced frontmatter section.
function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\n[\s\S]*?\n---\n?/, "");
}
